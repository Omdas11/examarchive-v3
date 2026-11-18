/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

const mockGetServerUser = jest.fn();
const mockIsValidSignedPdfDownloadToken = jest.fn();
const mockVerifyTurnstileDownloadToken = jest.fn();
const mockGetPaperByFileId = jest.fn();
const mockBucketGet = jest.fn();

jest.mock("@/lib/auth", () => ({
  getServerUser: () => mockGetServerUser(),
}));

jest.mock("@/lib/pdf-download-link", () => ({
  isValidSignedPdfDownloadToken: (...args: unknown[]) => mockIsValidSignedPdfDownloadToken(...args),
}));

jest.mock("@/lib/turnstile", () => ({
  verifyTurnstileDownloadToken: (...args: unknown[]) => mockVerifyTurnstileDownloadToken(...args),
}));

jest.mock("@/lib/d1", () => ({
  getPaperByFileId: (...args: unknown[]) => mockGetPaperByFileId(...args),
  getPapersBucket: async () => ({ get: (...args: unknown[]) => mockBucketGet(...args) }),
}));

import { GET } from "./route";

describe("GET /api/files/papers/[fileId] (R2)", () => {
  const PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // "%PDF-1.4"
  const FILE_ID = "6af6c28c33790c997464";
  const FILE_KEY = "papers/1687772351_History-General_Early-Assam-upto-1228AD_2019_6af6c28c33790c997464.pdf";

  beforeEach(() => {
    jest.resetAllMocks();
    mockIsValidSignedPdfDownloadToken.mockReturnValue(false);
    mockVerifyTurnstileDownloadToken.mockReturnValue(true);
    mockGetServerUser.mockResolvedValue(null);
    mockGetPaperByFileId.mockResolvedValue({
      fileId: FILE_ID,
      fileKey: FILE_KEY,
      paperName: "History General",
      courseCode: "HIS",
    });
    mockBucketGet.mockResolvedValue({
      arrayBuffer: async () => PDF_BYTES.buffer.slice(0) as ArrayBuffer,
    });
  });

  it("serves inline PDF from R2 for a guest with a valid Turnstile token (View)", async () => {
    const request = new NextRequest(
      `http://localhost/api/files/papers/${FILE_ID}?ctoken=valid-token`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(mockGetPaperByFileId).toHaveBeenCalledWith(FILE_ID);
    expect(mockBucketGet).toHaveBeenCalledWith(FILE_KEY);
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body).toEqual(PDF_BYTES);
  });

  it("serves attachment for a guest with a valid Turnstile token who requests download=1", async () => {
    const request = new NextRequest(
      `http://localhost/api/files/papers/${FILE_ID}?ctoken=valid-token&download=1`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="1687772351_History-General_Early-Assam-upto-1228AD_2019_6af6c28c33790c997464.pdf"',
    );
  });

  it("serves attachment for a valid signed token even without download=1", async () => {
    mockIsValidSignedPdfDownloadToken.mockReturnValue(true);
    mockVerifyTurnstileDownloadToken.mockReturnValue(false);

    const request = new NextRequest(
      `http://localhost/api/files/papers/${FILE_ID}?uid=u1&exp=9999999999&token=t1&download=1`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment;");
  });

  it("returns 404 when the paper is not in D1 (AI markdown fileIds land here)", async () => {
    mockGetPaperByFileId.mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost/api/files/papers/ai-job-file?ctoken=valid-token`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: "ai-job-file" }) });

    expect(response.status).toBe(404);
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("returns 404 when the paper has no file_key yet", async () => {
    mockGetPaperByFileId.mockResolvedValue({
      fileId: FILE_ID,
      fileKey: null,
      paperName: "",
      courseCode: "",
    });

    const request = new NextRequest(
      `http://localhost/api/files/papers/${FILE_ID}?ctoken=valid-token`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(404);
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("returns 404 when the R2 object is missing", async () => {
    mockBucketGet.mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost/api/files/papers/${FILE_ID}?ctoken=valid-token`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(404);
  });

  it("redirects to login when no valid token and no session user exists", async () => {
    mockIsValidSignedPdfDownloadToken.mockReturnValue(false);
    mockVerifyTurnstileDownloadToken.mockReturnValue(false);
    mockGetServerUser.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost/api/files/papers/${FILE_ID}`);
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(mockGetPaperByFileId).not.toHaveBeenCalled();
  });

  it("returns 403 for a logged-in user without a Turnstile token", async () => {
    mockIsValidSignedPdfDownloadToken.mockReturnValue(false);
    mockVerifyTurnstileDownloadToken.mockReturnValue(false);
    mockGetServerUser.mockResolvedValue({ $id: "user-1" });

    const request = new NextRequest(`http://localhost/api/files/papers/${FILE_ID}`);
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(403);
    expect(mockGetPaperByFileId).not.toHaveBeenCalled();
  });

  it("returns 400 when fileId is missing", async () => {
    const request = new NextRequest("http://localhost/api/files/papers/missing");
    const response = await GET(request, { params: Promise.resolve({ fileId: "" }) });

    expect(response.status).toBe(400);
  });

  it("blocks bots with 403", async () => {
    const request = new NextRequest(`http://localhost/api/files/papers/${FILE_ID}?ctoken=valid-token`, {
      headers: { "user-agent": "curl/8.0" },
    });
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(403);
    expect(mockGetPaperByFileId).not.toHaveBeenCalled();
  });

  it("returns 500 when the R2 read throws", async () => {
    mockBucketGet.mockRejectedValue(new Error("R2 down"));

    const request = new NextRequest(
      `http://localhost/api/files/papers/${FILE_ID}?ctoken=valid-token`,
    );
    const response = await GET(request, { params: Promise.resolve({ fileId: FILE_ID }) });

    expect(response.status).toBe(500);
  });
});
