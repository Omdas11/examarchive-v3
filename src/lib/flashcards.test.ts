const mockListDocuments = jest.fn();

jest.mock("@/lib/appwrite", () => {
  const Query = {
    equal: (attribute: string, value: string) => ({ method: "equal", attribute, values: [value] }),
    greaterThanEqual: (attribute: string, value: string) => ({
      method: "greaterThanEqual",
      attribute,
      values: [value],
    }),
  };
  return {
    Query,
    DATABASE_ID: "examarchive",
    COLLECTION: { ai_flashcards: "ai_flashcards" },
    adminDatabases: jest.fn(() => ({
      listDocuments: mockListDocuments,
    })),
  };
});

describe("checkDailyLimit", () => {
  beforeEach(() => {
    mockListDocuments.mockReset();
  });

  it("returns remaining allowance when under the limit", async () => {
    mockListDocuments.mockResolvedValue({ total: 2 });

    const { checkDailyLimit, DAILY_FLASHCARD_LIMIT } = await import("./flashcards");
    const result = await checkDailyLimit("user-123");

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(2);
    expect(result.limit).toBe(DAILY_FLASHCARD_LIMIT);
    expect(mockListDocuments).toHaveBeenCalledWith(expect.any(String), expect.any(String), [
      expect.objectContaining({ method: "equal", attribute: "userId", values: ["user-123"] }),
      expect.objectContaining({ attribute: "$createdAt", method: "greaterThanEqual" }),
    ]);
  });

  it("blocks when limit is reached", async () => {
    mockListDocuments.mockResolvedValue({ total: 5 });
    const { checkDailyLimit } = await import("./flashcards");

    const result = await checkDailyLimit("user-123");

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(5);
  });

  it("blocks when the database query fails", async () => {
    mockListDocuments.mockRejectedValue(new Error("not found"));
    const { checkDailyLimit } = await import("./flashcards");

    const result = await checkDailyLimit("user-123");

    expect(result.allowed).toBe(false);
  });
});
