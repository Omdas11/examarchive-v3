#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const MASTER_NOTES_PROMPT_PATH = path.resolve(__dirname, "../MASTER_NOTES_PROMPT.md");
const DEFAULT_MASTER_NOTES_PROMPT = `# Master Notes Prompt

You are writing official ExamArchive unit notes in Markdown only.

STRICT MATH FORMATTING RULES:
1. You MUST use standard LaTeX for all equations. Use exactly \`$$\` for block equations and \`$\` for inline equations.
2. CRITICAL: NEVER escape dollar signs. Output \`$\` instead of \`\\$\`. Output \`$$\` instead of \`\\$\\$\`.
3. Ensure standard LaTeX commands are used correctly. Use \`\\frac\`, never \`lfrac\` or \`Ifrac\`.

MANDATORY DOCUMENT STRUCTURE (exact order):
1. Header:
   - Begin with title: \`# ExamArchive Notes Dossier\`
   - Then include:
     - \`- Paper Code: <paper_code>\`
     - \`- Paper Name: <paper_name>\`
     - \`- Unit: <unit_number>\`
2. Syllabus Highlights:
   - Add \`## Syllabus Highlights\` with a bulleted list of core topics covered in the unit.
3. Content Sections:
   - Provide detailed theoretical explanations for each topic using clear, hierarchical headings.
4. Theoretical Worked Examples:
   - Add a distinct \`## Theoretical Worked Examples\` section for key concepts.
   - Use exact labels for each example:
     - \`Problem:\`
     - \`Solution:\` (step-by-step)
     - \`Conclusion:\`
5. Revision Checklist:
   - Conclude major topics with a bulleted checklist of key takeaways for exam preparation.

GLOBAL OUTPUT RULES:
- Keep content exam-focused and syllabus-aligned.
- Do not invent facts beyond provided syllabus/question context.
- Do not use HTML, SVG, XML, canvas, or code markup in the response.
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
