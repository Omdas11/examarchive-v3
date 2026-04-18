/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockGetDocument = jest.fn();
const mockUpdateDocument = jest.fn();
const mockListDocuments = jest.fn();
const mockAdminDatabases = jest.fn(() => ({
  getDocument: mockGetDocument,
  updateDocument: mockUpdateDocument,
  listDocuments: mockListDocuments,
}));

jest.mock("@/lib/appwrite", () => ({
  adminDatabases: () => mockAdminDatabases(),
  COLLECTION: { ai_generation_jobs: "ai_generation_jobs", users: "users" },
  DATABASE_ID: "examarchive",
}));

const mockSendGenerationPdfEmail = jest.fn();
const mockSendGenerationFailureEmail = jest.fn();

jest.mock("@/lib/generation-notifications", () => ({
  sendGenerationPdfEmail: (...args: unknown[]) => mockSendGenerationPdfEmail(...args),
  sendGenerationFailureEmail: (...args: unknown[]) => mockSendGenerationFailureEmail(...args),
}));

const WEBHOOK_SECRET = "test-webhook-secret";
type SentPdfEmailPayload = { downloadUrl: string };

function makeRequest(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) {
    headers["Authorization"] = `Bearer ${secret}`;
  }
  return new NextRequest("http://localhost/api/ai/notify-completion", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/notify-completion", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, AI_JOB_WEBHOOK_SECRET: WEBHOOK_SECRET };
    mockUpdateDocument.mockResolvedValue({});
    mockListDocuments.mockResolvedValue({ documents: [] });
    mockAdminDatabases.mockReturnValue({
      getDocument: mockGetDocument,
      updateDocument: mockUpdateDocument,
      listDocuments: mockListDocuments,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 503 when webhook secret is not configured", async () => {
    delete process.env.AI_JOB_WEBHOOK_SECRET;
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" }, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/not configured/i);
  });

  it("returns 401 when no auth token provided", async () => {
    mockGetDocument.mockResolvedValue({
      $id: "job1",
      status: "queued",
      completed_at: "",
      result_file_id: "",
      input_payload_json: "{}",
    });
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 401 when wrong auth token provided", async () => {
    mockGetDocument.mockResolvedValue({
      $id: "job1",
      status: "running",
      completed_at: "",
      result_file_id: "file1",
      input_payload_json: "{}",
    });
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" }, "wrong-secret");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockGetDocument).not.toHaveBeenCalled();
  });

  it("accepts unverified completed callback when job state and fileId strictly match", async () => {
    mockGetDocument.mockResolvedValue({
      $id: "job1",
      status: "completed",
      completed_at: "2026-04-16T16:00:00.000Z",
      user_id: "user1",
      result_file_id: "file1",
      input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "CS101", unitNumber: 1, userEmail: "user@example.com" }),
      error_message: "",
    });
    mockSendGenerationPdfEmail.mockResolvedValue(undefined);
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("accepts unverified completed callback after short consistency delay when initial read is stale", async () => {
    mockGetDocument
      .mockResolvedValueOnce({
        $id: "job1",
        status: "running",
        completed_at: "",
        user_id: "user1",
        result_file_id: "",
        input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "CS101", unitNumber: 1, userEmail: "user@example.com" }),
        error_message: "",
      })
      .mockResolvedValueOnce({
        $id: "job1",
        status: "completed",
        completed_at: "2026-04-16T16:00:00.000Z",
        user_id: "user1",
        result_file_id: "file1",
        input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "CS101", unitNumber: 1, userEmail: "user@example.com" }),
        error_message: "",
      });
    mockSendGenerationPdfEmail.mockResolvedValue(undefined);
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockSendGenerationPdfEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects unverified completed callback when fileId does not match stored result", async () => {
    mockGetDocument.mockResolvedValue({
      $id: "job1",
      status: "completed",
      completed_at: "2026-04-16T16:00:00.000Z",
      user_id: "user1",
      result_file_id: "stored-file",
      input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "CS101", unitNumber: 1, userEmail: "user@example.com" }),
      error_message: "",
    });
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "different-file" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/ai/notify-completion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
      },
      body: "not-valid-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid json/i);
  });

  it("returns 400 when jobId is missing", async () => {
    const req = makeRequest({ status: "completed", fileId: "file1" }, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid payload/i);
  });

  it("returns 400 when status is invalid", async () => {
    const req = makeRequest({ jobId: "job1", status: "unknown", fileId: "file1" }, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid payload/i);
  });

  it("returns 404 when job is not found in db for verified callbacks", async () => {
    mockGetDocument.mockRejectedValue({ status: 404 });
    const req = makeRequest({ jobId: "missing-job", status: "completed", fileId: "file1" }, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 401 when job is not found in db for unverified callbacks", async () => {
    mockGetDocument.mockRejectedValue({ status: 404 });
    const req = makeRequest({ jobId: "missing-job", status: "completed", fileId: "file1" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it("returns 500 when db lookup fails with non-404 error", async () => {
    mockGetDocument.mockRejectedValue(new Error("db connection error"));
    const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" }, WEBHOOK_SECRET);
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  describe("completed status", () => {
    const jobDoc = {
      $id: "job1",
      user_id: "user1",
      result_file_id: "stored-file-id",
      input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "CS101", unitNumber: 1, userEmail: "user@example.com" }),
      error_message: "",
    };

    beforeEach(() => {
      mockGetDocument.mockResolvedValue(jobDoc);
    });

    it("sends completion email and returns ok:true for completed status", async () => {
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file-abc" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          title: expect.stringContaining("CS101"),
          downloadUrl: expect.stringContaining("file-abc"),
        }),
      );
    });

    it("falls back to result_file_id in job when fileId is not in body", async () => {
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({ downloadUrl: expect.stringContaining("stored-file-id") }),
      );
    });

    it("returns 400 when no fileId is available for completed job", async () => {
      mockGetDocument.mockResolvedValue({ ...jobDoc, result_file_id: "" });
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/missing fileid/i);
    });

    it("returns 500 when email sending fails", async () => {
      mockSendGenerationPdfEmail.mockRejectedValue(new Error("SMTP error"));
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file-abc" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/completion email/i);
    });

    it("returns 500 when completion email sentinel update fails", async () => {
      mockUpdateDocument.mockRejectedValue(new Error("write failed"));
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file-abc" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/record notification state/i);
      expect(mockSendGenerationPdfEmail).not.toHaveBeenCalled();
    });

    it("sends completion email even when callback does not provide a resolvable userId", async () => {
      mockGetDocument.mockResolvedValue({
        ...jobDoc,
        user_id: "",
        input_payload_json: JSON.stringify({
          jobType: "notes",
          paperCode: "CS101",
          unitNumber: 1,
          userEmail: "user@example.com",
        }),
      });
      mockListDocuments.mockResolvedValue({ documents: [] });
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file-abc" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          downloadUrl: expect.stringContaining("/api/files/papers/file-abc?download=1"),
        }),
      );
      const sentPayload = mockSendGenerationPdfEmail.mock.calls[0]?.[0] as SentPdfEmailPayload;
      expect(sentPayload.downloadUrl).not.toContain("uid=");
    });

    it("builds solved-paper title correctly", async () => {
      mockGetDocument.mockResolvedValue({
        ...jobDoc,
        input_payload_json: JSON.stringify({ jobType: "solved-paper", paperCode: "MATH202", year: 2023, userEmail: "user@example.com" }),
      });
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file-xyz" }, WEBHOOK_SECRET);
      await POST(req);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("MATH202") }),
      );
    });
  });

  describe("failed status", () => {
    const jobDoc = {
      $id: "job1",
      user_id: "user1",
      result_file_id: "",
      input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "CS101", unitNumber: 2, userEmail: "user@example.com" }),
      error_message: "Gotenberg returned 500",
    };

    beforeEach(() => {
      mockGetDocument.mockResolvedValue(jobDoc);
    });

    it("sends failure email and returns ok:true for failed status", async () => {
      mockSendGenerationFailureEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "failed", fileId: "" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(mockSendGenerationFailureEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          title: expect.stringContaining("CS101"),
          reason: "Gotenberg returned 500",
        }),
      );
    });

    it("returns 500 when failure email sending fails", async () => {
      mockSendGenerationFailureEmail.mockRejectedValue(new Error("SMTP failure"));
      const req = makeRequest({ jobId: "job1", status: "failed", fileId: "" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/failure email/i);
    });

    it("returns 500 when failure email sentinel update fails", async () => {
      mockUpdateDocument.mockRejectedValue(new Error("write failed"));
      const req = makeRequest({ jobId: "job1", status: "failed", fileId: "" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/record notification state/i);
      expect(mockSendGenerationFailureEmail).not.toHaveBeenCalled();
    });
  });

  describe("email resolution", () => {
    it("ignores unverified body userEmail when it does not match trusted payload email", async () => {
      mockGetDocument.mockResolvedValue({
        $id: "job1",
        status: "completed",
        completed_at: "2026-04-16T16:00:00.000Z",
        user_id: "user1",
        result_file_id: "file1",
        input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "X1", unitNumber: 1, userEmail: "payload@example.com" }),
        error_message: "",
      });
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({
        jobId: "job1",
        status: "completed",
        fileId: "file1",
        userEmail: "attacker@example.com",
      });
      await POST(req);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "payload@example.com" }),
      );
    });

    it("resolves email from userEmail in input_payload_json", async () => {
      mockGetDocument.mockResolvedValue({
        $id: "job1",
        user_id: "user1",
        result_file_id: "file1",
        input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "X1", unitNumber: 1, userEmail: "payload@example.com" }),
        error_message: "",
      });
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file1" }, WEBHOOK_SECRET);
      await POST(req);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "payload@example.com" }),
      );
    });

    it("falls back to user document email when payload has no userEmail", async () => {
      mockGetDocument
        .mockResolvedValueOnce({
          $id: "job1",
          user_id: "user-xyz",
          result_file_id: "file2",
          input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "A2", unitNumber: 3 }),
          error_message: "",
        })
        .mockResolvedValueOnce({ email: "fromdb@example.com" });
      mockSendGenerationPdfEmail.mockResolvedValue(undefined);
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file2" }, WEBHOOK_SECRET);
      await POST(req);
      expect(mockSendGenerationPdfEmail).toHaveBeenCalledWith(
        expect.objectContaining({ email: "fromdb@example.com" }),
      );
    });

    it("returns 500 when email cannot be resolved", async () => {
      mockGetDocument
        .mockResolvedValueOnce({
          $id: "job1",
          user_id: "",
          result_file_id: "file3",
          input_payload_json: JSON.stringify({ jobType: "notes", paperCode: "B3", unitNumber: 1 }),
          error_message: "",
        });
      const req = makeRequest({ jobId: "job1", status: "completed", fileId: "file3" }, WEBHOOK_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toMatch(/resolve recipient email/i);
    });
  });
});
