/**
 * @jest-environment node
 *
 * Node env (not jsdom): hashUploadCode uses crypto.subtle, which the
 * jsdom test env does not provide. The production code runs in the
 * Workers runtime, where crypto.subtle exists.
 */
import {
  MD_COMPLETION_CREDITS,
  MD_COMPLETION_XP,
  MD_MAX_BYTES,
  PDF_MAX_BYTES,
  clampPage,
  generateUploadCode,
  hashUploadCode,
  isValidPaperCode,
  normalizePaperCodeInput,
  resolveMdCompleter,
  shouldAwardMdXp,
  validateUploadInput,
  verificationPdfKey,
} from "./md-verification";

describe("md-verification helpers", () => {
  it("normalises and validates paper codes", () => {
    expect(normalizePaperCodeInput("  phydsc401t ")).toBe("PHYDSC401T");
    expect(isValidPaperCode("PHYDSC401T")).toBe(true);
    expect(isValidPaperCode("COM-DSC-301T")).toBe(true);
    expect(isValidPaperCode("UNIVAC-101T")).toBe(true);
    expect(isValidPaperCode("")).toBe(false);
    expect(isValidPaperCode("AB")).toBe(false);
    expect(isValidPaperCode("12345")).toBe(false);
    expect(isValidPaperCode("PHYDSC401T!")).toBe(false);
    expect(isValidPaperCode(null)).toBe(false);
  });

  it("hashes upload codes with SHA-256 (known vector)", async () => {
    // SHA-256("test"), the standard test vector.
    await expect(hashUploadCode("test")).resolves.toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    );
    const a = await hashUploadCode("code-one");
    const b = await hashUploadCode("code-two");
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    // Same code hashes the same way every time (lookup by hash works).
    await expect(hashUploadCode("code-one")).resolves.toBe(a);
  });

  it("generates URL-safe upload codes", () => {
    const code = generateUploadCode();
    expect(code).toHaveLength(43);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateUploadCode()).not.toBe(code);
  });

  it("validates an upload payload", () => {
    const base = {
      paperCode: "PHYDSC401T",
      type: "question",
      batchId: "batch-1",
      mdText: "# Mechanics\n\nUnit 1",
      pdfSize: 1024,
      pdfName: "paper.pdf",
    };
    expect(validateUploadInput(base)).toBeNull();
    expect(validateUploadInput({ ...base, paperCode: "!!" })).toBe(
      "Invalid paper_code",
    );
    expect(validateUploadInput({ ...base, type: "notes" })).toBe(
      "Invalid type: expected question or syllabus",
    );
    expect(validateUploadInput({ ...base, mdText: "" })).toBe(
      "md text is required",
    );
    expect(
      validateUploadInput({ ...base, mdText: "x".repeat(MD_MAX_BYTES + 1) }),
    ).toBe("md text exceeds the 2 MB limit");
    expect(
      validateUploadInput({ ...base, pdfSize: PDF_MAX_BYTES + 1 }),
    ).toBe("PDF exceeds the 25 MB limit");
    expect(validateUploadInput({ ...base, pdfName: "paper.txt" })).toBe(
      "PDF file must have a .pdf extension",
    );
    // PDF is optional; md-only uploads are valid.
    expect(validateUploadInput({ ...base, pdfSize: null, pdfName: null })).toBeNull();
  });

  it("clamps page numbers", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(3)).toBe(3);
    expect(clampPage(99999)).toBe(1000);
  });

  it("builds private R2 keys under the md-verification prefix", () => {
    expect(verificationPdfKey("batch-1", "item-123")).toBe(
      "md-verification/batch-1/item-123.pdf",
    );
  });

  it("awards completion XP once, to the completer, on approval only", () => {
    // Same size as the moderator-accepted correction bonus.
    expect(MD_COMPLETION_XP).toBe(25);
    expect(MD_COMPLETION_CREDITS).toBe(5);

    const pending = {
      status: "pending",
      xp_awarded: 0,
      edited_by: "editor-1",
      submitted_by: "submitter-1",
      assigned_to: "assignee-1",
    };
    expect(shouldAwardMdXp(pending)).toBe(true);
    // Editor wins over submitter, assignee and approver.
    expect(resolveMdCompleter(pending, "approver-1")).toBe("editor-1");
    // Falls back down the chain when earlier fields are empty.
    expect(
      resolveMdCompleter(
        { status: "pending", xp_awarded: 0, submitted_by: "submitter-1" },
        "approver-1",
      ),
    ).toBe("submitter-1");
    expect(
      resolveMdCompleter(
        { status: "pending", xp_awarded: 0, assigned_to: "assignee-1" },
        "approver-1",
      ),
    ).toBe("assignee-1");
    // Approver is the last fallback (self-approve earns it once).
    expect(
      resolveMdCompleter({ status: "pending", xp_awarded: 0 }, "approver-1"),
    ).toBe("approver-1");
    expect(resolveMdCompleter({ status: "pending", xp_awarded: 0 }, "")).toBe(
      null,
    );

    // Once-only guard: already approved, or XP already awarded.
    expect(
      shouldAwardMdXp({ ...pending, status: "approved" }),
    ).toBe(false);
    expect(shouldAwardMdXp({ ...pending, xp_awarded: 25 })).toBe(false);
    expect(
      shouldAwardMdXp({ ...pending, xp_awarded: 25, xp_awarded_to: "editor-1" }),
    ).toBe(false);
    // in_review / needs_fix items can still earn it on approval.
    expect(shouldAwardMdXp({ ...pending, status: "in_review" })).toBe(true);
    expect(shouldAwardMdXp({ ...pending, status: "needs_fix" })).toBe(true);
  });
});
