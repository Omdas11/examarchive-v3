/**
 * @jest-environment node
 */
import { GET } from "./route";

describe("/api/ai/status", () => {
  const OLD_GEMINI = process.env.GEMINI_API_KEY;
  const OLD_GOOGLE = process.env.GOOGLE_API_KEY;

  afterEach(() => {
    if (OLD_GEMINI === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = OLD_GEMINI;
    if (OLD_GOOGLE === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = OLD_GOOGLE;
  });

  it("returns configured=false when no API key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it("returns configured=true when GEMINI_API_KEY is set", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GOOGLE_API_KEY;
    const res = await GET();
    expect(await res.json()).toEqual({ configured: true });
  });

  it("returns configured=true when only GOOGLE_API_KEY is set", async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = "test-key";
    const res = await GET();
    expect(await res.json()).toEqual({ configured: true });
  });

  it("ignores blank/whitespace keys", async () => {
    process.env.GEMINI_API_KEY = "   ";
    delete process.env.GOOGLE_API_KEY;
    const res = await GET();
    expect(await res.json()).toEqual({ configured: false });
  });
});
