describe("pdf-download-link", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PDF_DOWNLOAD_TOKEN_SECRET: "test-secret",
    };
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("builds signed download paths", async () => {
    const { buildSignedPdfDownloadPath } = await import("./pdf-download-link");
    const path = buildSignedPdfDownloadPath({
      fileId: "file_123",
      userId: "user_456",
      ttlSeconds: 300,
    });
    expect(path).toContain("/api/files/papers/file_123?");
    expect(path).toContain("download=1");
    expect(path).toContain("uid=user_456");
    expect(path).toContain("exp=1700000300");
    expect(path).toMatch(/token=[a-f0-9]{64}/);
  });

  it("validates matching signed token and rejects expired token", async () => {
    const { buildSignedPdfDownloadPath, isValidSignedPdfDownloadToken } = await import("./pdf-download-link");
    const path = buildSignedPdfDownloadPath({
      fileId: "file_abc",
      userId: "user_xyz",
      ttlSeconds: 300,
    });
    const url = new URL(path, "https://example.com");
    expect(isValidSignedPdfDownloadToken({
      fileId: "file_abc",
      userId: "user_xyz",
      expires: url.searchParams.get("exp") || "",
      token: url.searchParams.get("token") || "",
    })).toBe(true);
    expect(isValidSignedPdfDownloadToken({
      fileId: "file_abc",
      userId: "user_xyz",
      expires: "1",
      token: url.searchParams.get("token") || "",
    })).toBe(false);
  });

  it("rejects malformed or oversized token inputs", async () => {
    const { buildSignedPdfDownloadPath, isValidSignedPdfDownloadToken } = await import("./pdf-download-link");
    const path = buildSignedPdfDownloadPath({
      fileId: "file_abc",
      userId: "user_xyz",
      ttlSeconds: 300,
    });
    const url = new URL(path, "https://example.com");
    const exp = url.searchParams.get("exp") || "";

    expect(isValidSignedPdfDownloadToken({
      fileId: "file_abc",
      userId: "user_xyz",
      expires: exp,
      token: "not-hex",
    })).toBe(false);

    expect(isValidSignedPdfDownloadToken({
      fileId: "f".repeat(300),
      userId: "user_xyz",
      expires: exp,
      token: url.searchParams.get("token") || "",
    })).toBe(false);
  });
});
