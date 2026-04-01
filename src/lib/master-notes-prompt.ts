import fs from "fs";
import path from "path";

export const MASTER_NOTES_PROMPT_PATH = path.resolve(process.cwd(), "MASTER_NOTES_PROMPT.md");

export const DEFAULT_MASTER_NOTES_PROMPT = `# Master Notes Prompt

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

export function ensureMasterNotesPromptFile(filePath = MASTER_NOTES_PROMPT_PATH): string {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, DEFAULT_MASTER_NOTES_PROMPT, "utf8");
  }
  return filePath;
}

export function readMasterNotesPrompt(filePath = MASTER_NOTES_PROMPT_PATH): string {
  ensureMasterNotesPromptFile(filePath);
  return fs.readFileSync(filePath, "utf8");
}
