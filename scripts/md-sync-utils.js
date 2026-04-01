const crypto = require("crypto");

const SYNC_REMARKS_HEADING = "### Sync Remarks (Auto-Generated)";

function stripSyncRemarks(markdown) {
  const marker = `\n---\n${SYNC_REMARKS_HEADING}`;
  const idx = markdown.indexOf(marker);
  if (idx === -1) {
    return markdown.replace(/\s+$/, "") + "\n";
  }
  return markdown.slice(0, idx).replace(/\s+$/, "") + "\n";
}

function hashCoreContent(markdown) {
  const core = stripSyncRemarks(markdown);
  return crypto.createHash("sha256").update(core).digest("hex");
}

function renderSyncRemarks({ timestamp, overallStatus, connected, errors }) {
  const connectedLines = connected.length > 0 ? connected.map((line) => `- ${line}`).join("\n") : "- None";
  const errorLines = errors.length > 0 ? errors.map((line) => `- ${line}`).join("\n") : "- None";
  return [
    "---",
    SYNC_REMARKS_HEADING,
    `**Last Synced:** ${timestamp}`,
    `**Overall Status:** ${overallStatus}`,
    "**Connected:**",
    connectedLines,
    "**Not Connected / Errors:**",
    errorLines,
  ].join("\n");
}

function upsertSyncRemarks(markdown, remarksBlock) {
  const core = stripSyncRemarks(markdown).replace(/\s+$/, "");
  return `${core}\n\n${remarksBlock}\n`;
}

function parseMarkdownTable(tableMarkdown) {
  const lines = tableMarkdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  if (lines.length < 3) return [];
  const headers = lines[0].split("|").map((part) => part.trim().toLowerCase());

  const fieldIndex = headers.findIndex((header) => header === "field" || header === "`field`");
  const typeIndex = headers.findIndex((header) => header === "type" || header === "`type`");
  const requiredIndex = headers.findIndex((header) => header === "required" || header === "`required`");
  if (fieldIndex === -1 || typeIndex === -1 || requiredIndex === -1) return [];

  return lines.slice(2).map((line) => {
    const parts = line.split("|").map((part) => part.trim());
    const field = (parts[fieldIndex] || "").replace(/`/g, "");
    const type = (parts[typeIndex] || "").toLowerCase();
    const requiredRaw = (parts[requiredIndex] || "").toLowerCase();
    return {
      key: field,
      type,
      required: requiredRaw.includes("yes"),
    };
  }).filter((row) => row.key);
}

function toAttributeType(type) {
  if (type.includes("integer")) return "integer";
  if (type.includes("boolean")) return "boolean";
  if (type.includes("datetime")) return "datetime";
  if (type.includes("float")) return "float";
  return "string";
}

function parseDatabaseSchemaMarkdown(markdown) {
  const core = stripSyncRemarks(markdown);
  const sections = core.split(/^##\s+/m).slice(1);
  const tables = [];

  for (const section of sections) {
    const firstLine = section.split("\n")[0] || "";
    const nameMatch = firstLine.match(/(?:Collection|Table):\s*`?([^`\n]+)`?/i);
    if (!nameMatch) continue;
    const rawName = nameMatch[1].trim();
    const id = rawName;
    const attributes = parseMarkdownTable(section).map((row) => ({
      key: row.key,
      type: toAttributeType(row.type),
      required: row.required,
      size: toAttributeType(row.type) === "string" ? 1024 : undefined,
    }));
    tables.push({ id, name: rawName, attributes });
  }

  return tables;
}

module.exports = {
  SYNC_REMARKS_HEADING,
  hashCoreContent,
  parseDatabaseSchemaMarkdown,
  renderSyncRemarks,
  stripSyncRemarks,
  upsertSyncRemarks,
};
