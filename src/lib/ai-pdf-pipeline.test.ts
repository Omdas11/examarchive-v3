import { InputFile } from "node-appwrite/file";
import { adminStorage } from "@/lib/appwrite";
import { buildPdfHtml, buildSafePdfFileName, renderMarkdownPdfToAppwrite } from "./ai-pdf-pipeline";

jest.mock("node-appwrite/file", () => ({
  InputFile: {
    fromBuffer: jest.fn(),
  },
}));
jest.mock("@/lib/appwrite", () => ({
  adminStorage: jest.fn(),
  BUCKET_ID: "bucket",
  ID: { unique: jest.fn(() => "id") },
  getAppwriteFileDownloadUrl: jest.fn((id: string) => `/api/files/papers/${id}?download=1`),
}));

describe("ai-pdf-pipeline", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GOTENBERG_AUTH_TOKEN;
    jest.resetAllMocks();
  });

  it("sanitizes rendered markdown html content", () => {
    const html = buildPdfHtml({
      markdown: `## Safe\n<script>alert("x")</script>\n<img src="x" onerror="alert(1)" /><a href="javascript:alert(2)">x</a>`,
    });
    const mainContent = html.slice(html.indexOf("<main>"), html.indexOf("</main>"));

    expect(mainContent).toContain("<h2>Safe</h2>");
    expect(mainContent).not.toContain("<script");
    expect(mainContent).not.toContain("alert(");
    expect(mainContent).not.toContain('href="javascript:');
    expect(mainContent).not.toContain("onerror=");
    expect(mainContent).not.toContain("javascript:");
  });

  it("escapes untrusted metadata on cover and syllabus bullets", () => {
    const html = buildPdfHtml({
      markdown: "content",
      paperCode: `<img src=x onerror=alert(1)>`,
      syllabusContent: `A&B;<b>Topic</b>;"quoted"`,
      unitNumber: 1,
      year: 2025,
    });

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("A&amp;B");
    expect(html).toContain("&lt;b&gt;Topic&lt;/b&gt;");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("always returns a .pdf filename", () => {
    expect(buildSafePdfFileName({ fileBaseName: "abc" })).toBe("abc.pdf");
    expect(buildSafePdfFileName({ fileBaseName: "abc", fileName: "weird name" })).toBe("weird_name.pdf");
    expect(buildSafePdfFileName({ fileBaseName: "abc", fileName: "x.pdf" })).toBe("x.pdf");
    expect(buildSafePdfFileName({ fileBaseName: "!!!", fileName: "???" })).toBe("generated_document.pdf");
  });

  it("renders latex expressions into mathml for PDF output", () => {
    const html = buildPdfHtml({
      markdown: "Inline: $C_i = VC + AFC$ and block:\n\n$$x = y + z$$",
    });
    const mainContent = html.slice(html.indexOf("<main>"), html.indexOf("</main>"));

    expect(mainContent).toContain("<math");
    expect(mainContent).toContain("<mrow>");
    expect(mainContent).not.toContain("$C_i = VC + AFC$");
    expect(mainContent).not.toContain("$$x = y + z$$");
  });

  it("keeps escaped dollars and supports escaped backslash before delimiters", () => {
    const html = buildPdfHtml({
      markdown: String.raw`Price is \$50 and formula after escaped slash pair: \\ $$a+b$$`,
    });
    const mainContent = html.slice(html.indexOf("<main>"), html.indexOf("</main>"));

    expect(mainContent).toContain("$50");
    expect(mainContent).toContain("escaped slash pair: \\ ");
    expect(mainContent).toContain("<math");
    expect(mainContent).not.toContain("$$a+b$$");
  });

  it("adds Authorization header when gotenbergAuthToken is provided", async () => {
    const createFile = jest.fn().mockResolvedValue(undefined);
    (adminStorage as jest.Mock).mockReturnValue({ createFile });
    (InputFile.fromBuffer as jest.Mock).mockReturnValue({ mocked: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => "",
    }) as unknown as typeof fetch;

    await renderMarkdownPdfToAppwrite({
      markdown: "# Title",
      fileBaseName: "test",
      gotenbergUrl: "https://example-gotenberg.local",
      gotenbergAuthToken: "secret-token",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://example-gotenberg.local/forms/chromium/convert/html",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
      }),
    );
  });

  it("normalizes token formatting before building Bearer header", async () => {
    const createFile = jest.fn().mockResolvedValue(undefined);
    (adminStorage as jest.Mock).mockReturnValue({ createFile });
    (InputFile.fromBuffer as jest.Mock).mockReturnValue({ mocked: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => "",
    }) as unknown as typeof fetch;

    await renderMarkdownPdfToAppwrite({
      markdown: "# Title",
      fileBaseName: "test",
      gotenbergUrl: "https://example-gotenberg.local",
      gotenbergAuthToken: " \"Bearer secret-token\" ",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example-gotenberg.local/forms/chromium/convert/html",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
      }),
    );
  });

  it("normalizes single-quoted token formatting before building Bearer header", async () => {
    const createFile = jest.fn().mockResolvedValue(undefined);
    (adminStorage as jest.Mock).mockReturnValue({ createFile });
    (InputFile.fromBuffer as jest.Mock).mockReturnValue({ mocked: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => "",
    }) as unknown as typeof fetch;

    await renderMarkdownPdfToAppwrite({
      markdown: "# Title",
      fileBaseName: "test",
      gotenbergUrl: "https://example-gotenberg.local",
      gotenbergAuthToken: " 'secret-token' ",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example-gotenberg.local/forms/chromium/convert/html",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
      }),
    );
  });

  it("normalizes whitespace-only token formatting before building Bearer header", async () => {
    const createFile = jest.fn().mockResolvedValue(undefined);
    (adminStorage as jest.Mock).mockReturnValue({ createFile });
    (InputFile.fromBuffer as jest.Mock).mockReturnValue({ mocked: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => "",
    }) as unknown as typeof fetch;

    await renderMarkdownPdfToAppwrite({
      markdown: "# Title",
      fileBaseName: "test",
      gotenbergUrl: "https://example-gotenberg.local",
      gotenbergAuthToken: "   secret-token   ",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example-gotenberg.local/forms/chromium/convert/html",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
      }),
    );
  });

  it("sends HTML/header/footer payloads using FormData files key", async () => {
    const createFile = jest.fn().mockResolvedValue(undefined);
    (adminStorage as jest.Mock).mockReturnValue({ createFile });
    (InputFile.fromBuffer as jest.Mock).mockReturnValue({ mocked: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      text: async () => "",
    }) as unknown as typeof fetch;

    await renderMarkdownPdfToAppwrite({
      markdown: "# Title",
      fileBaseName: "test",
      gotenbergUrl: "https://example-gotenberg.local",
      gotenbergAuthToken: "secret-token",
    });

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]?.[1] as { body?: FormData } | undefined;
    expect(fetchCall?.body).toBeInstanceOf(FormData);
    const files = fetchCall?.body?.getAll("files") as File[] | undefined;
    expect(files).toHaveLength(3);
    expect(files?.[0]?.name).toBe("index.html");
    expect(files?.[0]?.type).toBe("text/html");
    expect((global.fetch as jest.Mock).mock.calls[0]?.[1]?.headers).not.toHaveProperty("Content-Type");
  });

  it("throws when no gotenbergAuthToken is provided", async () => {
    const createFile = jest.fn().mockResolvedValue(undefined);
    (adminStorage as jest.Mock).mockReturnValue({ createFile });
    (InputFile.fromBuffer as jest.Mock).mockReturnValue({ mocked: true });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      text: async () => "",
    }) as unknown as typeof fetch;

    await expect(renderMarkdownPdfToAppwrite({
      markdown: "# Title",
      fileBaseName: "test",
      gotenbergUrl: "https://example-gotenberg.local",
    })).rejects.toThrow("Missing GOTENBERG_AUTH_TOKEN");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
