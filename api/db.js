// api/db.js
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "deploy.db");

let db;

export async function dbInit() {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, timestamp INTEGER, email TEXT, task TEXT, round INTEGER, nonce TEXT,
      brief TEXT, checks TEXT, evaluation_url TEXT, secret_ok INTEGER, raw_request TEXT
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id TEXT PRIMARY KEY, timestamp INTEGER, email TEXT, task TEXT, round INTEGER, nonce TEXT,
      repo_url TEXT, commit_sha TEXT, pages_url TEXT
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY, timestamp INTEGER, email TEXT, task TEXT, round INTEGER, repo_url TEXT, commit_sha TEXT, pages_url TEXT,
      check_name TEXT, score REAL, reason TEXT, logs TEXT
    );
  `);
}

export async function saveTaskToDB(task) {
  const q = `INSERT INTO tasks (id,timestamp,email,task,round,nonce,brief,checks,evaluation_url,secret_ok,raw_request)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
  await db.run(q, task.id, task.timestamp, task.email, task.task, task.round, task.nonce, task.brief, JSON.stringify(task.checks||[]), task.evaluation_url, task.secret_ok ? 1 : 0, task.raw_request || "");
}

export async function saveRepoToDB(repo) {
  const q = `INSERT INTO repos (id,timestamp,email,task,round,nonce,repo_url,commit_sha,pages_url)
             VALUES (?,?,?,?,?,?,?,?,?)`;
  await db.run(q, repo.id, repo.timestamp, repo.email, repo.task, repo.round, repo.nonce, repo.repo_url, repo.commit_sha, repo.pages_url);
}

export async function findTaskByEmailTaskRoundNonce(email, task, round, nonce) {
  return db.get(`SELECT * FROM tasks WHERE email=? AND task=? AND round=? AND nonce=?`, email, task, round, nonce);
}

export async function getReposToEvaluate() {
  return db.all(`SELECT * FROM repos WHERE timestamp > 0`);
}

export default db;
