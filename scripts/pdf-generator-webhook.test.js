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
  renderToString: jest.fn((expr) => "<math>" + expr + "</math>"),
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

const { Databases, Storage, Query } = require("node-appwrite");
const {
  notifyCompletionWebhook,
  getNotifyCompletionUrl,
  processGenerationJob,
  runGeminiCompletionWithRetry,
  sanitizeAiMath,
  markdownToPdfHtml,
  validateSafeUrl,
  getAllowedWebhookHosts,
} = require("../appwrite-functions/pdf-generator/index.js");

describe("pdf-generator / validateSafeUrl", () => {
  it("allows trusted hosts", () => {
    expect(validateSafeUrl("https://generativelanguage.googleapis.com/v1", ["generativelanguage.googleapis.com"])).toBe("https://generativelanguage.googleapis.com/v1");
  });

  it("allows wildcard subdomains", () => {
    expect(validateSafeUrl("https://sub.example.com/api", ["*.example.com"])).toBe("https://sub.example.com/api");
    expect(validateSafeUrl("https://example.com/api", ["*.example.com"])).toBe("https://example.com/api");
  });

  it("blocks untrusted hosts", () => {
    expect(() => validateSafeUrl("https://malicious.com", ["trusted.com"])).toThrow("Forbidden host: malicious.com. Not in the allowed list.");
  });

  it("blocks non-HTTPS protocols", () => {
    expect(() => validateSafeUrl("http://trusted.com", ["trusted.com"])).toThrow("Forbidden protocol: http:. Only HTTPS is allowed.");
    expect(() => validateSafeUrl("ftp://trusted.com", ["trusted.com"])).toThrow("Forbidden protocol: ftp:. Only HTTPS is allowed.");
  });

  it("throws on invalid URL format", () => {
    expect(() => validateSafeUrl("not-a-url")).toThrow("Invalid URL format");
    expect(() => validateSafeUrl("")).toThrow("URL is empty");
  });

  it("handles case-insensitive host matching", () => {
    expect(validateSafeUrl("https://EXAMPLE.COM/api", ["example.com"])).toBe("https://example.com/api");
    expect(validateSafeUrl("https://example.com/api", ["EXAMPLE.COM"])).toBe("https://example.com/api");
  });

  it("blocks port-specific SSRF attempts if not in allowed list", () => {
    // Current implementation doesn't check ports specifically, but hostname check should still work.
    expect(() => validateSafeUrl("https://localhost:8080", ["example.com"])).toThrow("Forbidden host: localhost. Not in the allowed list.");
  });

  it("handles multiple allowed hosts", () => {
    const allowed = ["a.com", "b.com", "*.c.com"];
    expect(validateSafeUrl("https://a.com/x", allowed)).toBe("https://a.com/x");
    expect(validateSafeUrl("https://b.com/y", allowed)).toBe("https://b.com/y");
    expect(validateSafeUrl("https://sub.c.com/z", allowed)).toBe("https://sub.c.com/z");
  });

  it("allows any HTTPS URL when allowedHosts is empty", () => {
    expect(validateSafeUrl("https://any-domain.com/path", [])).toBe("https://any-domain.com/path");
    expect(validateSafeUrl("https://another.net", [])).toBe("https://another.net/");
  });
});

describe("pdf-generator / getAllowedWebhookHosts", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("includes SITE_URL and its subdomains", () => {
    process.env.SITE_URL = "https://www.example.com";
    const hosts = getAllowedWebhookHosts();
    expect(hosts).toContain("www.example.com");
    expect(hosts).toContain("example.com");
    expect(hosts).toContain("*.example.com");
  });

  it("includes VERCEL_URL subdomains", () => {
    process.env.VERCEL_URL = "my-app.vercel.app";
    const hosts = getAllowedWebhookHosts();
    expect(hosts).toContain("my-app.vercel.app");
    expect(hosts).toContain("*.vercel.app");
  });

  it("handles complex domains correctly", () => {
    process.env.SITE_URL = "https://app.staging.example.co.uk";
    const hosts = getAllowedWebhookHosts();
    expect(hosts).toContain("app.staging.example.co.uk");
    expect(hosts).toContain("staging.example.co.uk");
    expect(hosts).toContain("*.staging.example.co.uk");
  });
});

const { InputFile } = require("node-appwrite/file");

function isGeminiApiCall(url) {
  try {
    return new URL(String(url)).hostname === "generativelanguage.googleapis.com";
  } catch {
    return false;
  }
}

describe("pdf-generator / getNotifyCompletionUrl", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty string when SITE_URL is not set", () => {
    process.env = { ...originalEnv };
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
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

  it("accepts callbackUrl override even when origin differs from SITE_URL", () => {
    process.env = { ...originalEnv, SITE_URL: "https://www.example.com" };
    const url = getNotifyCompletionUrl("https://preview.example.com/api/ai/notify-completion");
    expect(url).toBe("https://preview.example.com/api/ai/notify-completion");
  });

  it("falls back to VERCEL_URL when SITE_URL is missing", () => {
    process.env = { ...originalEnv, VERCEL_URL: "preview-123.examarchive.vercel.app" };
    const url = getNotifyCompletionUrl();
    expect(url).toBe("https://preview-123.examarchive.vercel.app/api/ai/notify-completion");
  });

  it("prefers preview VERCEL_URL over production SITE_URL during Vercel preview deployments", () => {
    process.env = {
      ...originalEnv,
      SITE_URL: "https://examarchive.in",
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview-abc123.vercel.app",
    };
    const url = getNotifyCompletionUrl();
    expect(url).toBe("https://preview-abc123.vercel.app/api/ai/notify-completion");
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

describe("pdf-generator / math sanitization and rendering", () => {
  it("normalizes escaped/dollar math delimiters to bracket delimiters", () => {
    const input = "Price is \\$99 and math is \\$a+b\\$ and display is \\$\\$x^2\\$\\$.";
    const output = sanitizeAiMath(input);
    expect(output).toContain("\\$99");
    expect(output).toContain("\\(a+b\\)");
    expect(output).toContain("\\[x^2\\]");
  });

  it("fixes malformed l/pipe latex command prefixes from the allowlist", () => {
    const input = "Use lfrac{a}{b} and |sqrt{x} and |pi.";
    const output = sanitizeAiMath(input);
    expect(output).toContain("\\frac{a}{b}");
    expect(output).toContain("\\sqrt{x}");
    expect(output).toContain("\\pi");
  });

  it("renders markdown html with bracket math preserved for MathJax", async () => {
    const html = await markdownToPdfHtml("Inline \\(x+y\\) and block \\[z^2\\]", "Math Test");
    expect(html).toContain("Inline \\(x+y\\) and block \\[z^2\\]");
    expect(html).toContain("cdn.jsdelivr.net/npm/mathjax");
    expect(html).toContain("displayMath");
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
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
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

  it("uses callbackUrl override for webhook delivery even when origin differs from SITE_URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({
      jobId: "job-preview",
      status: "completed",
      fileId: "file-preview",
      callbackUrl: "https://preview.example.com/api/ai/notify-completion",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://preview.example.com/api/ai/notify-completion");
  });

  it("allows preview callbackUrl override when SITE_URL points to production but VERCEL preview env is available", async () => {
    process.env.SITE_URL = "https://examarchive.in";
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "preview-xyz789.vercel.app";
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await notifyCompletionWebhook({
      jobId: "job-preview",
      status: "completed",
      fileId: "file-preview",
      callbackUrl: "https://preview-xyz789.vercel.app/api/ai/notify-completion",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://preview-xyz789.vercel.app/api/ai/notify-completion");
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

describe("pdf-generator / runGeminiCompletionWithRetry", () => {
  const originalFetch = global.fetch;
  const originalAbortSignalTimeout = AbortSignal.timeout;

  afterEach(() => {
    global.fetch = originalFetch;
    AbortSignal.timeout = originalAbortSignalTimeout;
    jest.restoreAllMocks();
  });

  it("uses strict exponential backoff for 503 retries and succeeds on the fifth attempt", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const timeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation((handler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    AbortSignal.timeout = jest.fn(() => undefined);
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Service Unavailable 1" })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Service Unavailable 2" })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Service Unavailable 3" })
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Service Unavailable 4" })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      });

    const result = await runGeminiCompletionWithRetry({
      apiKey: "gemini-key",
      prompt: "hello",
      model: "gemini-3.1-flash-lite-preview",
    });

    expect(result).toBe("ok");
    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(warnSpy).toHaveBeenNthCalledWith(1, "[Gemini Attempt 1] Failed with status 503. Retrying in 3000ms...");
    expect(warnSpy).toHaveBeenNthCalledWith(2, "[Gemini Attempt 2] Failed with status 503. Retrying in 6000ms...");
    expect(warnSpy).toHaveBeenNthCalledWith(3, "[Gemini Attempt 3] Failed with status 503. Retrying in 12000ms...");
    expect(warnSpy).toHaveBeenNthCalledWith(4, "[Gemini Attempt 4] Failed with status 503. Retrying in 24000ms...");
    expect(timeoutSpy.mock.calls.map((call) => call[1])).toEqual(expect.arrayContaining([3000, 6000, 12000, 24000]));
  });

  it("retries 503 up to five attempts and then throws", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const timeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation((handler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    AbortSignal.timeout = jest.fn(() => undefined);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(
      runGeminiCompletionWithRetry({
        apiKey: "gemini-key",
        prompt: "hello",
        model: "gemini-3.1-flash-lite-preview",
      }),
    ).rejects.toThrow("Gemini request failed (status 503)");

    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(warnSpy).toHaveBeenCalledTimes(4);
    expect(warnSpy).toHaveBeenLastCalledWith("[Gemini Attempt 4] Failed with status 503. Retrying in 24000ms...");
    expect(timeoutSpy.mock.calls.map((call) => call[1])).toEqual(expect.arrayContaining([3000, 6000, 12000, 24000]));
  });
});

describe("pdf-generator / processGenerationJob cache behavior", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const originalAbortSignalTimeout = AbortSignal.timeout;

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
    AbortSignal.timeout = originalAbortSignalTimeout;
    jest.restoreAllMocks();
  });

  it("uses payload cachedMarkdown fast-path and skips cache bucket + Gemini calls", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn(),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn(),
      getFileDownload: jest.fn(),
      createFile: jest.fn().mockResolvedValue({ $id: "pdf-file-fast-path" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("%PDF-1.4"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

    const result = await processGenerationJob(JSON.stringify({
      jobId: "job-cached-markdown",
      payload: {
        jobType: "notes",
        university: "Test Uni",
        course: "BTECH",
        stream: "CSE",
        type: "Regular",
        paperCode: "CS101",
        unitNumber: 1,
        cachedMarkdown: "   # Prefetched cached markdown   ",
      },
    }));

    expect(mockStorage.listFiles).not.toHaveBeenCalled();
    expect(mockStorage.getFileDownload).not.toHaveBeenCalled();
    expect(mockDb.listDocuments).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls.some(([url]) => isGeminiApiCall(url))).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      "[pdf-generator] Using cachedMarkdown from dispatch payload (global cache hit).",
      expect.objectContaining({ markdownLength: "# Prefetched cached markdown".length }),
    );
    expect(result.fileId).toBe("pdf-file-fast-path");
  });

  it("ignores whitespace-only cachedMarkdown and falls back to normal generation flow", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn().mockResolvedValue({
        documents: [{ $id: "syllabus-1", syllabus_content: "Topic A\nTopic B" }],
      }),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({ files: [] }),
      createFile: jest.fn().mockResolvedValue({ $id: "pdf-file-fallback" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (isGeminiApiCall(url)) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "# Gemini markdown" }] } }] }),
        };
      }
      if (String(url).includes("/forms/chromium/convert/html")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from("%PDF-1.4"),
        };
      }
      return { ok: true, status: 200, text: async () => "" };
    });
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const result = await processGenerationJob(JSON.stringify({
      jobId: "job-whitespace-cached-markdown",
      payload: {
        jobType: "notes",
        university: "Test Uni",
        course: "BTECH",
        stream: "CSE",
        type: "Regular",
        paperCode: "CS101",
        unitNumber: 1,
        cachedMarkdown: "     ",
      },
    }));

    expect(mockStorage.listFiles).toHaveBeenCalled();
    expect(global.fetch.mock.calls.some(([url]) => isGeminiApiCall(url))).toBe(true);
    expect(logSpy).not.toHaveBeenCalledWith(
      "[pdf-generator] Using cachedMarkdown from dispatch payload (global cache hit).",
      expect.any(Object),
    );
    expect(result.fileId).toBe("pdf-file-fallback");
  });

  it("falls back to fresh generation when cache read throws", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn().mockResolvedValue({
        documents: [{ $id: "syllabus-1", syllabus_content: "Topic A\nTopic B" }],
      }),
    };
    Databases.mockImplementation(() => mockDb);

    const cacheReadError = new Error("cache backend unavailable");
    const mockStorage = {
      listFiles: jest.fn().mockRejectedValue(cacheReadError),
      createFile: jest.fn().mockResolvedValue({ $id: "pdf-file-after-cache-read-fail" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (isGeminiApiCall(url)) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "# Gemini markdown" }] } }] }),
        };
      }
      if (String(url).includes("/forms/chromium/convert/html")) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => Buffer.from("%PDF-1.4"),
        };
      }
      return { ok: true, status: 200, text: async () => "" };
    });
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const result = await processGenerationJob(JSON.stringify({
      jobId: "job-cache-read-fail",
      payload: {
        jobType: "notes",
        university: "Test Uni",
        course: "BTECH",
        stream: "CSE",
        type: "Regular",
        paperCode: "CS101",
        unitNumber: 1,
      },
    }));

    expect(mockStorage.listFiles).toHaveBeenCalledWith("cached-unit-notes", expect.any(Array));
    expect(warnSpy).toHaveBeenCalledWith(
      "[pdf-generator] Markdown cache read failed. Proceeding with fresh generation.",
      expect.objectContaining({
        jobId: "job-cache-read-fail",
        jobType: "notes",
        cacheBucketId: "cached-unit-notes",
        message: "cache backend unavailable",
      }),
    );
    expect(global.fetch.mock.calls.some(([url]) => isGeminiApiCall(url))).toBe(true);
    expect(result.fileId).toBe("pdf-file-after-cache-read-fail");
  });

  it("reads markdown from cache bucket and avoids fresh Gemini generation calls", async () => {
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn(),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({
        files: [{ $id: "cache-file-1", name: "CS101_1_CSE_BTECH_Regular_Test_Uni_na_gemini-3_1-flash-lite-preview.md", $createdAt: "2026-04-18T00:00:00.000Z" }],
      }),
      getFileDownload: jest.fn().mockResolvedValue(Buffer.from("# Cached markdown", "utf8")),
      createFile: jest.fn().mockResolvedValue({ $id: "pdf-file-1" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("%PDF-1.4"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

    const result = await processGenerationJob(JSON.stringify({
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
    }));

    expect(mockStorage.listFiles).toHaveBeenCalledWith("cached-unit-notes", expect.any(Array));
    expect(mockStorage.getFileDownload).toHaveBeenCalledWith("cached-unit-notes", "cache-file-1");
    expect(mockDb.listDocuments).not.toHaveBeenCalled();
    expect(mockStorage.createFile).toHaveBeenCalledWith(
      "papers",
      "mock-id",
      expect.any(Object),
    );
    expect(result.fileId).toBe("pdf-file-1");
  });

  it("falls back to legacy cache key query when new-format cache key finds no match", async () => {
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn(),
    };
    Databases.mockImplementation(() => mockDb);

    // First listFiles call (new cacheKey) returns empty; second (legacyCacheKey) returns the legacy file.
    const mockStorage = {
      listFiles: jest.fn()
        .mockResolvedValueOnce({ files: [] })
        .mockResolvedValueOnce({
          files: [{ $id: "legacy-cache-file-1", name: "CS101_1_CSE_BTECH_Regular.md", $createdAt: "2025-01-01T00:00:00.000Z" }],
        }),
      getFileDownload: jest.fn().mockResolvedValue(Buffer.from("# Legacy cached markdown", "utf8")),
      createFile: jest.fn().mockResolvedValue({ $id: "pdf-file-legacy" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("%PDF-1.4"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

    const result = await processGenerationJob(JSON.stringify({
      jobId: "job-legacy-cache",
      payload: {
        jobType: "notes",
        university: "Test Uni",
        course: "BTECH",
        stream: "CSE",
        type: "Regular",
        paperCode: "CS101",
        unitNumber: 1,
      },
    }));

    // Both the new-key and legacy-key queries must have been issued.
    expect(mockStorage.listFiles).toHaveBeenCalledTimes(2);
    // The second call should use the legacy cache key.
    const secondCall = mockStorage.listFiles.mock.calls[1];
    expect(secondCall[0]).toBe("cached-unit-notes");
    // The legacy file was found so Gemini should NOT have been called.
    expect(global.fetch.mock.calls.some(([url]) => isGeminiApiCall(url))).toBe(false);
    expect(mockStorage.getFileDownload).toHaveBeenCalledWith("cached-unit-notes", "legacy-cache-file-1");
    expect(mockDb.listDocuments).not.toHaveBeenCalled();
    expect(result.fileId).toBe("pdf-file-legacy");
  });

  it("fails the job when cache write fails (no file ID means result is lost)", async () => {
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn().mockResolvedValue({ documents: [{ $id: "syllabus-1", syllabus_content: "Topic A\nTopic B" }] }),
    };
    Databases.mockImplementation(() => mockDb);

    const cacheWriteError = new Error("Storage quota exceeded");
    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({ files: [] }), // no cache hit
      createFile: jest.fn().mockRejectedValue(cacheWriteError),
    };
    Storage.mockImplementation(() => mockStorage);

    // Mock Gemini API and completion webhook fetch calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "# Markdown" }] } }] }),
    });

    process.env.GEMINI_API_KEY = "test-gemini-key";

    await expect(
      processGenerationJob(JSON.stringify({
        jobId: "job-cache-fail",
        payload: {
          jobType: "notes",
          university: "Test Uni",
          course: "BTECH",
          stream: "CSE",
          type: "Regular",
          paperCode: "CS101",
          unitNumber: 1,
        },
      }))
    ).rejects.toThrow(/Storage quota exceeded|Markdown cache write failed/);

    // Job should be marked as failed, not completed
    const updateCalls = mockDb.updateDocument.mock.calls;
    const completedCall = updateCalls.find((call) => call[3]?.status === "completed");
    const failedCall = updateCalls.find((call) => call[3]?.status === "failed");
    expect(completedCall).toBeUndefined();
    expect(failedCall).toBeDefined();
  });

  it("marks job failed and sends failed webhook payload when Gemini retries are exhausted", async () => {
    const timeoutSpy = jest.spyOn(global, "setTimeout").mockImplementation((handler) => {
      if (typeof handler === "function") handler();
      return 0;
    });
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn().mockResolvedValue({
        documents: [{ $id: "syllabus-1", syllabus_content: "Topic A\nTopic B" }],
      }),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({ files: [] }),
      createFile: jest.fn(),
    };
    Storage.mockImplementation(() => mockStorage);
    AbortSignal.timeout = jest.fn(() => undefined);
    global.fetch = jest.fn().mockImplementation(async (url) => {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.hostname === "generativelanguage.googleapis.com") {
        return { ok: false, status: 503, text: async () => "Service Unavailable" };
      }
      return { ok: true, status: 200, text: async () => "" };
    });
    process.env.GEMINI_API_KEY = "test-gemini-key";

    await expect(
      processGenerationJob(JSON.stringify({
        jobId: "job-gemini-fail",
        payload: {
          jobType: "notes",
          university: "Test Uni",
          course: "BTECH",
          stream: "CSE",
          type: "Regular",
          paperCode: "CS101",
          unitNumber: 1,
          userId: "user-1",
          userEmail: "user@example.com",
        },
      })),
    ).rejects.toThrow("Gemini request failed (status 503)");

    expect(global.fetch).toHaveBeenCalledTimes(6);
    expect(mockDb.updateDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "job-gemini-fail",
      expect.objectContaining({ status: "failed" }),
    );
    const webhookCall = global.fetch.mock.calls.find(([url]) => String(url).includes("/api/ai/notify-completion"));
    expect(webhookCall).toBeDefined();
    expect(JSON.parse(webhookCall[1].body)).toEqual(expect.objectContaining({
      jobId: "job-gemini-fail",
      status: "failed",
      fileId: "",
      userId: "user-1",
      userEmail: "user@example.com",
    }));
    expect(timeoutSpy.mock.calls.map((call) => call[1])).toEqual(expect.arrayContaining([3000, 6000, 12000, 24000]));
  });

  it("passes unitNumber as an integer (not string) to the unit_number Appwrite query", async () => {
    // Ensure Query.equal is ready to record calls
    Query.equal.mockClear();
    Query.equal.mockImplementation((field, val) => ({ field, val, type: "equal" }));

    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn().mockResolvedValue({
        documents: [{ $id: "syllabus-1", syllabus_content: "Topic A\nTopic B" }],
      }),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({ files: [] }),
      createFile: jest.fn().mockResolvedValue({ $id: "pdf-file-unit-num-type" }),
    };
    Storage.mockImplementation(() => mockStorage);

    InputFile.fromBuffer.mockImplementation((buffer, name) => ({ buffer, name }));
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (isGeminiApiCall(url)) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: "# Gemini markdown" }] } }] }),
        };
      }
      if (String(url).includes("/forms/chromium/convert/html")) {
        return { ok: true, status: 200, arrayBuffer: async () => Buffer.from("%PDF-1.4") };
      }
      return { ok: true, status: 200, text: async () => "" };
    });
    process.env.GEMINI_API_KEY = "test-gemini-key";

    await processGenerationJob(JSON.stringify({
      jobId: "job-unit-num-type",
      payload: {
        jobType: "notes",
        university: "Test Uni",
        course: "BTECH",
        stream: "CSE",
        type: "Regular",
        paperCode: "CS101",
        unitNumber: 3,
      },
    }));

    const unitNumberCall = Query.equal.mock.calls.find(([field]) => field === "unit_number");
    expect(unitNumberCall).toBeDefined();
    expect(typeof unitNumberCall[1]).toBe("number");
    expect(unitNumberCall[1]).toBe(3);
  });

  it("includes Gemini responseBody in job error_message when a 4xx is returned", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const mockDb = {
      updateDocument: jest.fn().mockResolvedValue({}),
      listDocuments: jest.fn().mockResolvedValue({
        documents: [{ $id: "syllabus-1", syllabus_content: "Topic A\nTopic B" }],
      }),
    };
    Databases.mockImplementation(() => mockDb);

    const mockStorage = {
      listFiles: jest.fn().mockResolvedValue({ files: [] }),
      createFile: jest.fn(),
    };
    Storage.mockImplementation(() => mockStorage);
    AbortSignal.timeout = jest.fn(() => undefined);
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (isGeminiApiCall(url)) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: "API key not valid", status: "INVALID_ARGUMENT" } }),
        };
      }
      return { ok: true, status: 200, text: async () => "" };
    });
    process.env.GEMINI_API_KEY = "invalid-key";

    await expect(
      processGenerationJob(JSON.stringify({
        jobId: "job-gemini-4xx",
        payload: {
          jobType: "notes",
          university: "Test Uni",
          course: "BTECH",
          stream: "CSE",
          type: "Regular",
          paperCode: "CS101",
          unitNumber: 1,
          userId: "user-1",
          userEmail: "user@example.com",
        },
      })),
    ).rejects.toThrow("Gemini request failed (status 400)");

    const failedUpdate = mockDb.updateDocument.mock.calls.find((call) => call[3]?.status === "failed");
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate[3].error_message).toContain("responseBody=");
    expect(failedUpdate[3].error_message).toContain("API key not valid");
  });
});

describe("pdf-generator / runGeminiCompletion internals", () => {
  const { runGeminiCompletionWithRetry } = require("../appwrite-functions/pdf-generator/index.js");

  it("throws descriptive error when required fields are missing", async () => {
    await expect(runGeminiCompletionWithRetry({ apiKey: "", prompt: "hi" }))
      .rejects.toThrow("[Gemini preflight] Missing required value: gemini.apiKey is an empty string.");
    
    await expect(runGeminiCompletionWithRetry({ apiKey: "key", prompt: " " }))
      .rejects.toThrow("[Gemini preflight] Missing required value: gemini.prompt is an empty string.");
  });
});
