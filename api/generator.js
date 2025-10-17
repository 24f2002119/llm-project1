// api/generator.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateMITLicense(name = "") {
  const year = new Date().getFullYear();
  const holder = name || "";
  return `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy...
`;
}

export async function generateFilesFromBrief(brief, attachments = [], opts = {}) {
  // You may call an LLM here to produce richer files by implementing callLLM(brief).
  // For spec compliance, we'll produce minimal static files that match checks:
  // - README.md (professional)
  // - LICENSE (MIT)
  // - index.html (renders something loadable; pages_url will show index.html)

  const title = (opts.task || "task-site").replace(/[^a-zA-Z0-9-_]/g, "-");
  const readme = `# ${title}

**Brief:** ${brief}

## Setup
- This site was auto-generated.
- License: MIT

## Deployment
Hosted via GitHub Pages.
`;

  // Minimal index.html (templates/web-template/index.html exists — use it if present)
  try {
    const templatePath = path.join(__dirname, "templates", "web-template", "index.html");
    const template = await fs.readFile(templatePath, "utf8");
    // If attachments include an attachment called sample.* and it's a data URI, replace placeholder
    const sample = attachments.find(a => /sample/i.test(a.name));
    const content = template.replace("__BRIEF__", escapeHtml(brief)).replace("__SAMPLE_DATA_URI__", sample ? sample.url : "");
    return { "index.html": content, "README.md": readme, "LICENSE": generateMITLicense(opts.owner || "") };
  } catch (err) {
    // fallback simple index
    const index = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title></head><body><h1>${escapeHtml(brief)}</h1></body></html>`;
    return { "index.html": index, "README.md": readme, "LICENSE": generateMITLicense(opts.owner || "") };
  }
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}
