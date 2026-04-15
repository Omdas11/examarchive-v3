import { GeminiServiceError, runGeminiCompletion } from "./gemini";

describe("runGeminiCompletion", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses default model and prompt fallback contents", async () => {
    const timeoutSignal = new AbortController().signal;
    jest.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "  hello world  " }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await runGeminiCompletion({
      apiKey: "test-key",
      prompt: "Explain unit 1",
      maxTokens: 1200,
      temperature: 0.3,
    });

    expect(result).toEqual({
      content: "hello world",
      model: "gemini-3.1-flash-lite-preview",
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.1-flash-lite-preview:generateContent?key=test-key");
    expect(options.signal).toBe(timeoutSignal);
    expect(JSON.parse(String(options.body))).toMatchObject({
      contents: [{ role: "user", parts: [{ text: "Explain unit 1" }] }],
      generationConfig: { maxOutputTokens: 1200, temperature: 0.3 },
    });
  });

  it("combines timeout and caller signal and forwards custom contents", async () => {
    const timeoutSignal = new AbortController().signal;
    const callerSignal = new AbortController().signal;
    const mergedSignal = new AbortController().signal;
    jest.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const anySpy = jest.spyOn(AbortSignal, "any").mockReturnValue(mergedSignal);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "custom content" }] } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await runGeminiCompletion({
      apiKey: "key-2",
      prompt: "unused because contents is provided",
      maxTokens: 500,
      temperature: 0.1,
      signal: callerSignal,
      contents: [{ role: "user", parts: [{ text: "prebuilt payload" }] }],
    });

    expect(anySpy).toHaveBeenCalledWith([timeoutSignal, callerSignal]);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.signal).toBe(mergedSignal);
    expect(JSON.parse(String(options.body)).contents).toEqual([
      { role: "user", parts: [{ text: "prebuilt payload" }] },
    ]);
  });

  it("wraps network errors in GeminiServiceError", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("network down"));
    global.fetch = fetchMock as typeof fetch;

    await expect(
      runGeminiCompletion({
        apiKey: "k",
        prompt: "p",
        maxTokens: 1,
        temperature: 0,
      }),
    ).rejects.toMatchObject({
      status: 503,
      message: "network down",
    });
  });

  it("includes response body for non-ok responses", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "quota exceeded",
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(
      runGeminiCompletion({
        apiKey: "k",
        prompt: "p",
        maxTokens: 1,
        temperature: 0,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 429,
        message: "Gemini request failed (status 429)",
        responseBody: "quota exceeded",
      }),
    );
  });

  it("falls back to empty response body if response.text() fails", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error("read failed");
      },
    });
    global.fetch = fetchMock as typeof fetch;

    let thrown: unknown;
    try {
      await runGeminiCompletion({
        apiKey: "k",
        prompt: "p",
        maxTokens: 1,
        temperature: 0,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(GeminiServiceError);
    expect(thrown).toMatchObject({
      status: 500,
      responseBody: "",
    });
  });

  it("throws when Gemini returns empty content", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(
      runGeminiCompletion({
        apiKey: "k",
        prompt: "p",
        maxTokens: 1,
        temperature: 0,
      }),
    ).rejects.toMatchObject({
      status: 503,
      message: "Gemini returned an empty response",
    });
  });
});
