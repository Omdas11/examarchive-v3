#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const MASTER_NOTES_PROMPT_PATH = path.resolve(__dirname, "../MASTER_NOTES_PROMPT.md");
const DEFAULT_MASTER_NOTES_PROMPT = `# Master Notes Prompt

You are an expert university professor and exam mentor.

Generate complete, accurate, and exam-focused unit notes in **Markdown** only.

Rules:
1. Explain concepts in a structured and student-friendly manner.
2. Use clear headings, subheadings, bullet points, and tables where helpful.
3. Include derivations, definitions, frameworks, examples, and memory aids when relevant.
4. Integrate related past-question themes naturally into the notes.
5. End with a concise revision checklist.
6. Never invent database fields; only use the provided syllabus and question context.
`;

function ensureMasterNotesPrompt(filePath = MASTER_NOTES_PROMPT_PATH) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, DEFAULT_MASTER_NOTES_PROMPT, "utf8");
    console.log(`[create] ${filePath}`);
  } else {
    console.log(`[exists] ${filePath}`);
  }
}

if (require.main === module) {
  ensureMasterNotesPrompt();
}

module.exports = {
  DEFAULT_MASTER_NOTES_PROMPT,
  ensureMasterNotesPrompt,
  MASTER_NOTES_PROMPT_PATH,
};
