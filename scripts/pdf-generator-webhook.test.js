/**
 * Tests for the notifyCompletionWebhook and getNotifyCompletionUrl helpers
 * in the pdf-generator Appwrite function.
 */

jest.mock("node-appwrite", () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint() { return this; },
    setProject() { return this; },
    setKey() { return this; },
  })),
  Databases: jest.fn(),
  Storage: jest.fn(),
  Query: {
    equal: jest.fn(),
    limit: jest.fn(),
    orderAsc: jest.fn(),
    orderDesc: jest.fn(),
    search: jest.fn(),
  },
  ID: { unique: jest.fn(() => "mock-id") },
}));

jest.mock("node-appwrite/file", () => ({
  InputFile: { fromBuffer: jest.fn() },
}));

jest.mock("katex", () => ({
  renderToString: jest.fn((expr) => `<math>${expr}</math>`),
}), { virtual: true });

jest.mock("sanitize-html", () => {
  const sanitizeHtmlMock = jest.fn((html) => html);
  sanitizeHtmlMock.defaults = {
    allowedTags: [],
    allowedAttributes: {},
  };
  return sanitizeHtmlMock;
}, { virtual: true });

jest.mock("he", () => ({
  encode: jest.fn((str) => str),
}), { virtual: true });

const { Databases, Storage } = require("node-appwrite");
const { notifyCompletionWebhook, getNotifyCompletionUrl, processGenerationJob } = require("../appwrite-functions/pdf-generator/index.js");
const { InputFile } = require("node-appwrite/file");

describe("pdf-generator / getNotifyCompletionUrl", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty string when SITE_URL is not set", () => {
    process.env = { ...originalEnv };
    delete process.env.SITE_URL;
    expect(getNotifyCompletionUrl()).toBe("");
  });

  it("builds the correct notify-completion URL from SITE_URL", () => {
    process.env = { ...originalEnv, SITE_URL: "https://www.example.com" };
    const url = getNotifyCompletionUrl();
    expect(url).toBe("https://www.example.com/api/ai/notify-completion");
  });

  it("accepts callbackUrl override when origin matches SITE_URL", () => {
    process.env = { ...originalEnv, SITE_URL: "https://www.example.com" };
    const url = getNotifyCompletionUrl("https://www.example.com/api/ai/notify-completion");
    expect(url).toBe("https://www.example.com/api/ai/notify-completion");
  });

  it("rejects callbackUrl override when origin differs from SITE_URL", () => {
    process.env = { ...originalEnv, SITE_URL: "https://www.example.com" };
    const url = getNotifyCompletionUrl("https://preview.example.com/api/ai/notify-completion");
    expect(url).toBe("");
  });

  it("handles SITE_URL with trailing slash", () => {
    process.env = { ...originalEnv, SITE_URL: "https://www.example.com/" };
    const url = getNotifyCompletionUrl();
    expect(url).toBe("https://www.example.com/api/ai/notify-completion");
  });

  it("returns empty string for invalid SITE_URL", () => {
    process.env = { ...originalEnv, SITE_URL: "not-a-url" };
    const url = getNotifyCompletionUrl();
    expect(url).toBe("");
  });
});

describe("pdf-generator / notifyCompletionWebhook", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SITE_URL: "https://www.example.com",
      AI_JOB_WEBHOOK_SECRET: "test-secret-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("skips the webhook call when SITE_URL is not configured", async () => {
    delete process.env.SITE_URL;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await notifyCompletionWebhook({ jobId: "job1", status: "completed", fileId: "file1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to the notify-completion endpoint with the correct payload", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({ jobId: "job-abc", status: "completed", fileId: "file-xyz" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.example.com/api/ai/notify-completion");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["Authorization"]).toBe("Bearer test-secret-key");
    const body = JSON.parse(options.body);
    expect(body).toEqual({ jobId: "job-abc", status: "completed", fileId: "file-xyz" });
  });

  it("POSTs with failed status and empty fileId for failed jobs", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({ jobId: "job-fail", status: "failed", fileId: "" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ jobId: "job-fail", status: "failed", fileId: "" });
  });

  it("uses callbackUrl override for webhook delivery when origin matches SITE_URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({
      jobId: "job-preview",
      status: "completed",
      fileId: "file-preview",
      callbackUrl: "https://www.example.com/custom/notify",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://www.example.com/custom/notify");
  });

  it("skips callbackUrl override when origin differs from SITE_URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({
      jobId: "job-preview",
      status: "completed",
      fileId: "file-preview",
      callbackUrl: "https://preview.example.com/api/ai/notify-completion",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("includes Authorization header when AI_JOB_WEBHOOK_SECRET is set", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;
    process.env.AI_JOB_WEBHOOK_SECRET = "my-secret";

    await notifyCompletionWebhook({ jobId: "j1", status: "completed", fileId: "f1" });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBe("Bearer my-secret");
  });

  it("omits Authorization header when AI_JOB_WEBHOOK_SECRET is not set", async () => {
    delete process.env.AI_JOB_WEBHOOK_SECRET;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({ jobId: "j1", status: "completed", fileId: "f1" });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("logs error but does not throw when fetch fails with non-ok response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue("Internal Server Error"),
    });
    global.fetch = fetchMock;

    await expect(
      notifyCompletionWebhook({ jobId: "j1", status: "completed", fileId: "f1" })
    ).resolves.toBeUndefined();
  });

  it("logs error but does not throw when fetch throws a network error", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = fetchMock;

    await expect(
      notifyCompletionWebhook({ jobId: "j1", status: "failed", fileId: "" })
    ).resolves.toBeUndefined();
  });
});

describe("pdf-generator / processGenerationJob cache behavior", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      APPWRITE_PROJECT_ID: "project-id",
      APPWRITE_API_KEY: "secret",
      APPWRITE_BUCKET_ID: "papers",
      CACHED_UNIT_NOTES_BUCKET_ID: "cached-unit-notes",
      CACHED_SOLVED_PAPERS_BUCKET_ID: "cached-solved-papers",
      GOTENBERG_URL: "https://example.hf.space",
      GOTENBERG_AUTH_TOKEN: "hf_token",
      SITE_URL: "https://www.example.com",
      AI_JOB_WEBHOOK_SECRET: "test-secret-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reads markdown from cache bucket and avoids fresh Gemini generation calls", async () => {
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn(),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({
        files: [{ $id: "cache-file-1", name: "CS101_1_CSE_BTECH_Regular.md", $createdAt: "2026-04-18T00:00:00.000Z" }],
      }),
      getFileDownload: jest.fn().mockResolvedValue(Buffer.from("# Cached markdown", "utf8")),
      createFile: jest.fn()
        .mockResolvedValueOnce({ $id: "pdf-file-1" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("%PDF-1.4", "utf8"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

    await processGenerationJob(JSON.stringify({
      jobId: "job1",
      payload: {
        jobType: "notes",
        university: "Test Uni",
        course: "BTECH",
        stream: "CSE",
        type: "Regular",
        paperCode: "CS101",
        unitNumber: 1,
      },
    }), {
      markedParser: {
        parse: (markdown) => `<p>${String(markdown)}</p>`,
      },
    });

    expect(mockStorage.listFiles).toHaveBeenCalledWith("cached-unit-notes", expect.any(Array));
    expect(mockStorage.getFileDownload).toHaveBeenCalledWith("cached-unit-notes", "cache-file-1");
    expect(mockDb.listDocuments).not.toHaveBeenCalled();
    expect(mockStorage.createFile).toHaveBeenCalledWith("papers", "mock-id", expect.any(Object));
  });
});
