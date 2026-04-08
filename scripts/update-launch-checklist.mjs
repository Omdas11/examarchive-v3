#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checklistPath = path.join(root, "docs/launch/LAUNCH_CHECKLIST.md");
const progressPath =
  process.argv[2] ??
  path.join(root, "docs/launch/checklist-progress.json");

if (!fs.existsSync(checklistPath)) {
  console.error(`Checklist file not found: ${checklistPath}`);
  process.exit(1);
}

if (!fs.existsSync(progressPath)) {
  console.error(`Progress file not found: ${progressPath}`);
  process.exit(1);
}

let progress;
try {
  progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to read or parse progress file: ${progressPath}`);
  console.error(message);
  process.exit(1);
}
const itemStatus = progress.items ?? {};
const gateStatus = progress.gates ?? {};

let text = fs.readFileSync(checklistPath, "utf8");

text = text.replace(
  /^(\|\s*)(\d+)(\s*\|.*?\|\s*)(todo|in-progress|done)(\s*\|.*)$/gm,
  (line, p1, id, p3, status, p5) => {
    const next = itemStatus[id];
    if (!next) return line;
    if (!["todo", "in-progress", "done"].includes(next)) return line;
    return `${p1}${id}${p3}${next}${p5}`;
  },
);

for (const [gateName, status] of Object.entries(gateStatus)) {
  if (!["pass", "fail", "pending"].includes(status)) continue;
  const escaped = gateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(###\\s+${escaped}[\\s\\S]*?\\*\\*Gate status:\\*\\*\\s*\\\`)(pending|pass|fail)(\\\`)`,
    "m",
  );
  text = text.replace(pattern, `$1${status}$3`);
}

fs.writeFileSync(checklistPath, text);
console.log(`Updated ${path.relative(root, checklistPath)} using ${path.relative(root, progressPath)}`);
