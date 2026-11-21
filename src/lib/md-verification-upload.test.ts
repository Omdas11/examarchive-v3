/**
 * @jest-environment node
 *
 * Tests for the emailed-code upload flow (md-verification.ts pure
 * helpers): code generation, code usability, zip contents, hash compare.
 */
import {
  VERIFICATION_CODE_ALPHABET,
  VERIFICATION_CODE_MAX_ATTEMPTS,
  generateVerificationCode,
  hashesEqual,
  uploadCodeBlockedReason,
  validateZipEntries,
  type UploadCodeState,
} from "./md-verification";

const MB = 1024 * 1024;

function liveCode(overrides: Partial<UploadCodeState> = {}): UploadCodeState {
  return {
    used_at: null,
    revoked_at: null,
    expires_at: Date.now() + 60 * 60 * 1000,
    attempts: 0,
    ...overrides,
  };
}

describe("generateVerificationCode", () => {
  it("returns 6 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateVerificationCode();
      expect(code).toHaveLength(6);
      for (const ch of code) {
        expect(VERIFICATION_CODE_ALPHABET).toContain(ch);
      }
      expect(code).not.toMatch(/[01IO]/);
    }
  });

  it("generates different codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateVerificationCode());
    expect(seen.size).toBeGreaterThan(45);
  });
});

describe("uploadCodeBlockedReason", () => {
  it("allows a live code", () => {
    expect(uploadCodeBlockedReason(liveCode())).toBeNull();
  });

  it("blocks a used code", () => {
    expect(
      uploadCodeBlockedReason(liveCode({ used_at: Date.now() })),
    ).toMatch(/already used/);
  });

  it("blocks a revoked code", () => {
    expect(
      uploadCodeBlockedReason(liveCode({ revoked_at: Date.now() })),
    ).toMatch(/revoked/);
  });

  it("blocks an expired code", () => {
    expect(
      uploadCodeBlockedReason(liveCode({ expires_at: Date.now() - 1000 })),
    ).toMatch(/expired/);
  });

  it("blocks after 3 wrong attempts", () => {
    expect(
      uploadCodeBlockedReason(
        liveCode({ attempts: VERIFICATION_CODE_MAX_ATTEMPTS }),
      ),
    ).toMatch(/Too many wrong attempts/);
    expect(
      uploadCodeBlockedReason(
        liveCode({ attempts: VERIFICATION_CODE_MAX_ATTEMPTS - 1 }),
      ),
    ).toBeNull();
  });
});

describe("hashesEqual", () => {
  it("compares equal and different hex strings", () => {
    expect(hashesEqual("abc123", "abc123")).toBe(true);
    expect(hashesEqual("abc123", "abc124")).toBe(false);
    expect(hashesEqual("abc", "abcd")).toBe(false);
    expect(hashesEqual("", "")).toBe(true);
  });
});

describe("validateZipEntries", () => {
  const pdf = { name: "COMDSC-301T.pdf", size: 2 * MB };
  const md = { name: "COMDSC-301T.md", size: 9000 };

  it("accepts exactly one pdf and one md", () => {
    expect(validateZipEntries([pdf, md])).toEqual({
      pdfName: "COMDSC-301T.pdf",
      mdName: "COMDSC-301T.md",
    });
  });

  it("ignores macOS noise entries", () => {
    expect(
      validateZipEntries([
        pdf,
        md,
        { name: "__MACOSX/._COMDSC-301T.pdf", size: 100 },
        { name: ".DS_Store", size: 100 },
      ]),
    ).toEqual({ pdfName: "COMDSC-301T.pdf", mdName: "COMDSC-301T.md" });
  });

  it("rejects an empty zip", () => {
    expect(validateZipEntries([])).toEqual({ error: "The zip is empty" });
  });

  it("rejects a zip with no pdf", () => {
    expect(validateZipEntries([md])).toEqual({
      error: "The zip must contain one PDF file",
    });
  });

  it("rejects a zip with no md", () => {
    expect(validateZipEntries([pdf])).toEqual({
      error: "The zip must contain one markdown (.md) file",
    });
  });

  it("rejects two pdfs or two md files", () => {
    expect(
      validateZipEntries([pdf, { name: "other.pdf", size: 100 }, md]),
    ).toEqual({ error: "The zip must contain exactly one PDF file" });
    expect(
      validateZipEntries([pdf, md, { name: "extra.md", size: 100 }]),
    ).toEqual({
      error: "The zip must contain exactly one markdown (.md) file",
    });
  });

  it("rejects extra files", () => {
    expect(
      validateZipEntries([pdf, md, { name: "notes.txt", size: 10 }]),
    ).toEqual({
      error:
        "The zip must contain only one PDF and one md file (unexpected: notes.txt)",
    });
  });

  it("rejects oversize files", () => {
    expect(
      validateZipEntries([
        { name: "big.pdf", size: 26 * MB },
        md,
      ]),
    ).toEqual({ error: "PDF exceeds the 25 MB limit" });
    expect(
      validateZipEntries([
        pdf,
        { name: "big.md", size: 3 * MB },
      ]),
    ).toEqual({ error: "md text exceeds the 2 MB limit" });
  });
});
