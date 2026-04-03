import fs from "fs";
import path from "path";
import { ensureMasterNotesPromptFile, MASTER_NOTES_PROMPT_PATH } from "@/lib/master-notes-prompt";
import { ensureSolvedPaperPromptFile, SOLVED_PAPER_PROMPT_PATH } from "@/lib/solved-paper-prompt";

type PromptKind = "solved_paper" | "unit_notes";

const NOTES_STREAM_ROUTE = "/api/generate-notes-stream";
const SOLVED_PAPER_STREAM_ROUTE = "/api/generate-solved-paper-stream";

function determinePromptKind(params?: { routePath?: string; promptType?: PromptKind | string }): PromptKind {
  const promptType = typeof params?.promptType === "string" ? params.promptType.trim().toLowerCase() : "";
  const routePath = typeof params?.routePath === "string" ? params.routePath.trim().toLowerCase() : "";
  if (promptType === "unit_notes" || routePath === NOTES_STREAM_ROUTE) {
    return "unit_notes";
  }
  if (promptType === "solved_paper" || routePath === SOLVED_PAPER_STREAM_ROUTE) {
    return "solved_paper";
  }
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
