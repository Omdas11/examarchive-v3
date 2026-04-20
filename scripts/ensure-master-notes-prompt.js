#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const MASTER_NOTES_PROMPT_PATH = path.resolve(__dirname, "../MASTER_NOTES_PROMPT.md");
const DEFAULT_MASTER_NOTES_PROMPT = `# Master Notes Prompt

INSTRUCTIONS:
You are an academic formatting engine. You MUST output your response matching this exact Markdown template. Use double line breaks (\\n\\n) between all sections and bullet points.

=== BEGIN TEMPLATE ===
# ExamArchive Notes Dossier

**Paper Code:** {Insert Code}  
**Paper Name:** {Insert Name}  
**Unit:** {Insert Unit}  

---

## Syllabus Highlights
* {Highlight 1}

* {Highlight 2}

## {Topic Title}
{Theoretical Explanation}

### Theoretical Worked Example
**Problem:** {Problem statement}

**Solution:**
1. {Step 1}
2. {Step 2}

**Conclusion:** {Conclusion}
=== END TEMPLATE ===

MATH RULES:
- Inline math MUST be written as: The energy is $E = mc^2$.
- Block math MUST be written as:
$$
F = G \\frac{m_1 m_2}{r^2}
$$
- ALWAYS use the backslash \\ for commands (e.g., \\frac, \\pi, \\mu).
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
