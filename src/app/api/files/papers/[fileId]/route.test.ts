/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";

const mockGetServerUser = jest.fn();
const mockIsValidSignedPdfDownloadToken = jest.fn();
const mockRenderMarkdownToPdfBuffer = jest.fn();
const mockApplyDownloadWatermark = jest.fn(async (buf: ArrayBuffer) => buf);

const mockStorage = {
  getFile: jest.fn(),
  getFileDownload: jest.fn(),
  getFileView: jest.fn(),
};
const mockDb = {
  listDocuments: jest.fn(),
};

jest.mock("@/lib/auth", () => ({
  getServerUser: () => mockGetServerUser(),
}));

jest.mock("@/lib/pdf-download-link", () => ({
  isValidSignedPdfDownloadToken: (...args: unknown[]) => mockIsValidSignedPdfDownloadToken(...args),
}));

jest.mock("@/lib/ai-pdf-pipeline", () => ({
  renderMarkdownToPdfBuffer: (...args: unknown[]) => mockRenderMarkdownToPdfBuffer(...args),
}));

jest.mock("@/lib/pdf-watermark", () => ({
  applyDownloadWatermark: (...args: unknown[]) => mockApplyDownloadWatermark(...(args as [ArrayBuffer])),
}));

jest.mock("@/lib/appwrite", () => ({
  adminStorage: () => mockStorage,
  adminDatabases: () => mockDb,
  BUCKET_ID: "papers",
  CACHED_UNIT_NOTES_BUCKET_ID: "cached-unit-notes",
  CACHED_SOLVED_PAPERS_BUCKET_ID: "cached-solved-papers",
  DATABASE_ID: "examarchive",
  COLLECTION: { ai_generation_jobs: "ai_generation_jobs" },
  Query: {
    equal: jest.fn((field: string, value: unknown) => ({ method: "equal", field, value })),
    orderDesc: jest.fn((field: string) => ({ method: "orderDesc", field })),
    limit: jest.fn((value: number) => ({ method: "limit", value })),
  },
}));

import { GET } from "./route";

describe("GET /api/files/papers/[fileId]", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, GOTENBERG_URL: "http://gotenberg.local" };
    mockIsValidSignedPdfDownloadToken.mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("serves stored PDF directly from papers bucket", async () => {
    mockStorage.getFile.mockResolvedValue({ name: "stored.pdf" });
    mockStorage.getFileDownload.mockResolvedValue(Uint8Array.from([1, 2, 3]));

    const request = new NextRequest("http://localhost/api/files/papers/file-123?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-123" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
    expect(mockDb.listDocuments).not.toHaveBeenCalled();
    expect(mockRenderMarkdownToPdfBuffer).not.toHaveBeenCalled();
  });

  it("falls back to markdown rendering when papers file is missing", async () => {
    mockStorage.getFile.mockResolvedValue({ name: "generated.pdf" });
    mockStorage.getFileDownload
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { code: 404 }))
      .mockResolvedValueOnce(Uint8Array.from(Buffer.from("# Unit 1 notes", "utf8")));
    mockDb.listDocuments.mockResolvedValue({
      documents: [
        {
          input_payload_json: JSON.stringify({
            jobType: "notes",
            paperCode: "CS101",
            unitNumber: 1,
            userEmail: "user@example.com",
          }),
          completed_at: "2026-04-19T00:00:00.000Z",
        },
      ],
    });
    mockRenderMarkdownToPdfBuffer.mockResolvedValue(Buffer.from([37, 80, 68, 70]));

    const request = new NextRequest("http://localhost/api/files/papers/file-legacy?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-legacy" }) });

    expect(response.status).toBe(200);
    expect(mockDb.listDocuments).toHaveBeenCalledTimes(1);
    expect(mockRenderMarkdownToPdfBuffer).toHaveBeenCalledTimes(1);
    expect(mockStorage.getFileDownload).toHaveBeenNthCalledWith(2, "cached-unit-notes", "file-legacy");
  });

  it("returns 404 when file is missing in papers and cache fallback cannot resolve markdown", async () => {
    mockStorage.getFile.mockResolvedValue({ name: "missing.pdf" });
    mockStorage.getFileDownload.mockRejectedValue(Object.assign(new Error("not found"), { code: 404 }));
    mockDb.listDocuments.mockResolvedValue({ documents: [] });

    const request = new NextRequest("http://localhost/api/files/papers/file-missing?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-missing" }) });

    expect(response.status).toBe(404);
    expect(mockRenderMarkdownToPdfBuffer).not.toHaveBeenCalled();
  });

  it("falls back from papers view path when user is authenticated without download mode", async () => {
    mockIsValidSignedPdfDownloadToken.mockReturnValue(false);
    mockGetServerUser.mockResolvedValue({ $id: "user-1" });
    mockStorage.getFileView.mockRejectedValue(Object.assign(new Error("not found"), { code: 404 }));
    mockDb.listDocuments.mockResolvedValue({ documents: [] });

    const request = new NextRequest("http://localhost/api/files/papers/file-view");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-view" }) });

    expect(response.status).toBe(404);
    expect(mockStorage.getFile).not.toHaveBeenCalled();
    expect(mockStorage.getFileView).toHaveBeenCalledWith("papers", "file-view");
  });

  it("redirects to login when signed token is invalid and no session user exists", async () => {
    mockIsValidSignedPdfDownloadToken.mockReturnValue(false);
    mockGetServerUser.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/files/papers/file-auth");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-auth" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("returns 400 when fileId is missing", async () => {
    const request = new NextRequest("http://localhost/api/files/papers/missing");
    const response = await GET(request, { params: Promise.resolve({ fileId: "" }) });

    expect(response.status).toBe(400);
  });

  it("returns 503 when markdown fallback is available but GOTENBERG_URL is not configured", async () => {
    process.env = { ...originalEnv, GOTENBERG_URL: "" };
    mockStorage.getFile.mockResolvedValue({ name: "generated.pdf" });
    mockStorage.getFileDownload
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { code: 404 }))
      .mockResolvedValueOnce(Uint8Array.from(Buffer.from("# Unit 1 notes", "utf8")));
    mockDb.listDocuments.mockResolvedValue({
      documents: [{ input_payload_json: JSON.stringify({ jobType: "notes" }) }],
    });

    const request = new NextRequest("http://localhost/api/files/papers/file-legacy?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-legacy" }) });

    expect(response.status).toBe(503);
    expect(mockRenderMarkdownToPdfBuffer).not.toHaveBeenCalled();
  });

  it("uses solved-papers cache bucket for solved-paper markdown fallback", async () => {
    mockStorage.getFile.mockResolvedValue({ name: "generated.pdf" });
    mockStorage.getFileDownload
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { code: 404 }))
      .mockResolvedValueOnce(Uint8Array.from(Buffer.from("# Solved paper", "utf8")));
    mockDb.listDocuments.mockResolvedValue({
      documents: [
        {
          input_payload_json: JSON.stringify({ jobType: "solved-paper", paperCode: "CS101", year: 2025 }),
          completed_at: "2026-04-19T00:00:00.000Z",
        },
      ],
    });
    mockRenderMarkdownToPdfBuffer.mockResolvedValue(Buffer.from([37, 80, 68, 70]));

    const request = new NextRequest("http://localhost/api/files/papers/file-solved?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-solved" }) });

    expect(response.status).toBe(200);
    expect(mockStorage.getFileDownload).toHaveBeenNthCalledWith(2, "cached-solved-papers", "file-solved");
  });

  it("returns 500 when papers bucket lookup throws non-file-missing errors", async () => {
    mockStorage.getFile.mockRejectedValue(Object.assign(new Error("forbidden"), { code: 403 }));

    const request = new NextRequest("http://localhost/api/files/papers/file-err?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-err" }) });

    expect(response.status).toBe(500);
  });

  it("returns 404 when downstream error exposes code as a numeric string", async () => {
    mockStorage.getFile.mockResolvedValue({ name: "generated.pdf" });
    mockStorage.getFileDownload.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: 404 }));
    mockDb.listDocuments.mockImplementation(() => {
      throw Object.assign(new Error("invalid file id"), { code: "400" });
    });

    const request = new NextRequest("http://localhost/api/files/papers/file-code-string?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-code-string" }) });

    expect(response.status).toBe(404);
  });

  it("serves inline PDF from papers bucket when authenticated user does not request download", async () => {
    mockIsValidSignedPdfDownloadToken.mockReturnValue(false);
    mockGetServerUser.mockResolvedValue({ $id: "user-1" });
    mockStorage.getFileView.mockResolvedValue(Uint8Array.from([1, 2, 3]));

    const request = new NextRequest("http://localhost/api/files/papers/file-inline");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-inline" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(mockStorage.getFile).not.toHaveBeenCalled();
    expect(mockStorage.getFileView).toHaveBeenCalledWith("papers", "file-inline");
  });

  it("returns 404 when markdown rendering throws AppwriteException with missing-file code", async () => {
    mockStorage.getFile.mockResolvedValue({ name: "generated.pdf" });
    mockStorage.getFileDownload
      .mockRejectedValueOnce(Object.assign(new Error("not found"), { code: 404 }))
      .mockResolvedValueOnce(Uint8Array.from(Buffer.from("# Unit 1 notes", "utf8")));
    mockDb.listDocuments.mockResolvedValue({
      documents: [{ input_payload_json: JSON.stringify({ jobType: "notes" }) }],
    });
    mockRenderMarkdownToPdfBuffer.mockImplementation(() => {
      throw new AppwriteException("missing", 404);
    });

    const request = new NextRequest("http://localhost/api/files/papers/file-render-404?uid=u1&exp=1&token=t1");
    const response = await GET(request, { params: Promise.resolve({ fileId: "file-render-404" }) });

    expect(response.status).toBe(404);
  });
});
