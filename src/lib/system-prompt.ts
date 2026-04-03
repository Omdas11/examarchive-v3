import fs from "fs";
import path from "path";
import { ensureMasterNotesPromptFile, MASTER_NOTES_PROMPT_PATH } from "@/lib/master-notes-prompt";
import { ensureSolvedPaperPromptFile, SOLVED_PAPER_PROMPT_PATH } from "@/lib/solved-paper-prompt";

type PromptKind = "solved_paper" | "unit_notes";

function determinePromptKind(params?: { routePath?: string; promptType?: PromptKind | string }): PromptKind {
  const promptType = typeof params?.promptType === "string" ? params.promptType.trim().toLowerCase() : "";
  const routePath = typeof params?.routePath === "string" ? params.routePath.trim().toLowerCase() : "";
  if (promptType === "unit_notes" || routePath.endsWith("/api/generate-notes-stream")) {
    return "unit_notes";
  }
  if (promptType === "solved_paper" || routePath.endsWith("/api/generate-solved-paper-stream")) {
    return "solved_paper";
  }
  // Default to solved-paper to preserve previous behavior for callers that do not
  // pass route/prompt metadata while still keeping a deterministic fallback.
  return "solved_paper";
}

export function readDynamicSystemPrompt(params?: { routePath?: string; promptType?: PromptKind | string }): string {
  const promptKind = determinePromptKind(params);
  const promptFilePath =
    promptKind === "unit_notes"
      ? ensureMasterNotesPromptFile(MASTER_NOTES_PROMPT_PATH)
      : ensureSolvedPaperPromptFile(SOLVED_PAPER_PROMPT_PATH);
  const resolvedPromptPath = path.resolve(promptFilePath);
  try {
    return fs.readFileSync(resolvedPromptPath, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error ?? "unknown error");
    throw new Error(
      `[system-prompt] Failed to read ${promptKind} prompt from ${resolvedPromptPath}: ${reason}`,
    );
  }
}
