// api/server.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { saveTaskToDB, saveRepoToDB, dbInit } from "./db.js";
import { generateFilesFromBrief } from "./generator.js";
import { createGithubRepoAndPush, enablePagesWithGh } from "./github.js";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

dotenv.config();
await dbInit();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const SHARED_SECRET = process.env.SHARED_SECRET || "replace_me";
const ENABLE_GITHUB = process.env.ENABLE_GITHUB === "1";
const EVAL_POST_TIMEOUT = parseInt(process.env.EVAL_POST_TIMEOUT || "600", 10);

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

// Helper: exponential backoff poster (returns boolean ok)
async function postWithBackoff(url, jsonBody, maxAttempts = 6) {
  let attempt = 0;
  let wait = 1000;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonBody),
        timeout: 30_000
      });
      if (res.ok) {
        return true;
      } else {
        console.warn(`Eval URL returned ${res.status}. attempt=${attempt}`);
      }
    } catch (err) {
      console.warn("postWithBackoff error:", err.message);
    }
    await new Promise(r => setTimeout(r, wait));
    wait *= 2;
    attempt++;
  }
  return false;
}

/**
 * Student API endpoint: accepts JSON task request per spec.
 * - Verifies secret
 * - Saves attachments (data URIs) to disk
 * - Uses generator (LLM optional) to create files
 * - Creates GitHub repo & pushes
 * - Enables pages (tries)
 * - Saves repo record to DB
 * - Posts back to evaluation_url (async, with backoff)
 */
app.post("/api-endpoint", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") return res.status(400).json({ error: "invalid_json" });

    const { email, secret, task, round = 1, nonce, brief, checks = [], evaluation_url, attachments = [] } = payload;

    if (!email || !task || !nonce || !brief || !evaluation_url) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const secretOk = secret === SHARED_SECRET;
    const now = Date.now();
    const taskId = uuidv4();

    // Save to tasks table
    await saveTaskToDB({ id: taskId, timestamp: now, email, task, round, nonce, brief, checks, evaluation_url, secret_ok: secretOk, raw_request: JSON.stringify(payload).slice(0, 10000) });

    // If secret mismatch => return 401 (spec said verify and respond 200 on success)
    if (!secretOk) return res.status(401).json({ error: "secret_mismatch" });

    // Parse attachments and save to ./uploads
    const generatorOptions = { attachments };
    const filesMap = await generateFilesFromBrief(brief, attachments, { task }); // returns { "index.html": "...", "README.md": "...", "LICENSE": "..." }

    // Create repoName from task (unique)
    const repoName = `${task}-${Date.now().toString(36)}`.slice(0, 60);

    let repoUrl = null, commitSha = null, pagesUrl = null;

    if (ENABLE_GITHUB) {
      try {
        const result = await createGithubRepoAndPush({ ownerOrUser: process.env.GITHUB_USER, repoName, filesMap });
        repoUrl = result.repoUrl;
        commitSha = result.commitSha;
        pagesUrl = result.pagesUrl;
        // attempt to enable pages (may already be enabled)
        try {
          await enablePagesWithGh(repoName, process.env.GITHUB_USER);
        } catch (e) {
          console.warn("enablePagesWithGh failed:", e.message);
        }
      } catch (err) {
        console.error("github flow error:", err);
        // continue and respond ok but note that pages may not be enabled
      }
    } else {
      // Dry-run: write files to local ./out/<repoName> for manual inspection
      const fs = await import("fs/promises");
      const outDir = path.join(__dirname, "..", "out", repoName);
      await fs.mkdir(outDir, { recursive: true });
      for (const [p, content] of Object.entries(filesMap)) {
        await fs.writeFile(path.join(outDir, p), content, "utf8");
      }
      repoUrl = `file://${outDir}`;
      commitSha = "local-dry-run";
      pagesUrl = repoUrl;
    }

    // Save repo record
    await saveRepoToDB({ id: uuidv4(), timestamp: now, email, task, round, nonce, repo_url: repoUrl, commit_sha: commitSha, pages_url: pagesUrl });

    // Build evaluation payload
    const evalPayload = { email, task, round, nonce, repo_url: repoUrl, commit_sha: commitSha, pages_url: pagesUrl };

    // Fire-and-forget evaluation POST (with backoff). Must be done within 10 minutes. We'll start it async.
    (async () => {
      const ok = await postWithBackoff(evaluation_url, evalPayload, 8);
      if (!ok) console.warn("Failed to POST to evaluation_url after retries:", evaluation_url);
    })();

    // Respond 200 (per spec: Send a HTTP 200 JSON response)
    return res.status(200).json({ ok: true, message: "Accepted", repo_url: repoUrl, pages_url: pagesUrl });
  } catch (err) {
    console.error("api-endpoint error:", err);
    return res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

/**
 * Evaluation notify endpoint: instructors use this to POST repo details.
 * This endpoint accepts JSON payloads from students and inserts into repos table.
 * If matching task/nonce found, returns 200. Otherwise 400.
 */
app.post("/evaluation/notify", async (req, res) => {
  try {
    const payload = req.body;
    const { email, task, round, nonce, repo_url, commit_sha, pages_url } = payload;
    if (!email || !task || !nonce) return res.status(400).json({ error: "missing_fields" });

    // Validate against tasks table
    const { findTaskByEmailTaskRoundNonce } = await import("./db.js");
    const found = await findTaskByEmailTaskRoundNonce(email, task, round, nonce);
    if (!found) {
      return res.status(400).json({ error: "no_matching_task" });
    }

    // Save to repos table
    await saveRepoToDB({ id: uuidv4(), timestamp: Date.now(), email, task, round, nonce, repo_url, commit_sha, pages_url });

    return res.status(200).json({ ok: true, message: "Repo recorded" });
  } catch (err) {
    console.error("evaluation notify error:", err);
    return res.status(500).json({ error: "internal_error", detail: err.message });
  }
});

app.get("/health", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => console.log(`API server listening on port ${PORT}`));
