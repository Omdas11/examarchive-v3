import fs from "fs";
import path from "path";

export const TOPIC_NOTES_PROMPT_PATH = path.resolve(process.cwd(), "TOPIC_NOTES_PROMPT.md");

export const DEFAULT_TOPIC_NOTES_PROMPT = `# Topic Notes Prompt

You are an expert professor writing a comprehensive textbook chapter.

You have been given ONE specific sub-topic from the syllabus.

You must write an exhaustive 3 to 4-page detailed explanation strictly on this sub-topic.

Include historical context, complete step-by-step mathematical derivations, multiple theoretical examples, and profound insights.

Review the provided list of past exam questions.
If any question pertains to THIS specific sub-topic, integrate its full, step-by-step solution into your text.

STRICT RULE:
- Do NOT summarize.
- Do NOT skip steps in math.
- Do NOT use HTML, SVG, canvas, XML, or drawing code.
- ALL math must be in LaTeX enclosed in \`$\` for inline and \`$$\` for blocks.
`;

export function ensureTopicNotesPromptFile(filePath = TOPIC_NOTES_PROMPT_PATH): string {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, DEFAULT_TOPIC_NOTES_PROMPT, "utf8");
  }
  return filePath;
}

export function readTopicNotesPrompt(filePath = TOPIC_NOTES_PROMPT_PATH): string {
  ensureTopicNotesPromptFile(filePath);
  return fs.readFileSync(filePath, "utf8");
}
