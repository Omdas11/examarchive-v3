jest.mock("node-appwrite", () => ({
  Client: jest.fn().mockImplementation(() => ({
    setEndpoint() {
      return this;
    },
    setProject() {
      return this;
    },
    setKey() {
      return this;
    },
  })),
  Databases: jest.fn(),
  Query: {
    limit: (value) => ({ type: "limit", value }),
    cursorAfter: (value) => ({ type: "cursorAfter", value }),
  },
}));

const {
  sanitizeDocumentData,
  parseCollectionIds,
  listAllDocuments,
  upsertDocument,
  loadSyncConfig,
} = require("./sync-prod-to-preview");

describe("sync-prod-to-preview", () => {
  test("sanitizeDocumentData strips Appwrite system keys", () => {
    expect(
      sanitizeDocumentData({
        $id: "abc",
        $createdAt: "now",
        title: "Hello",
        nested: { ok: true },
      }),
    ).toEqual({
      title: "Hello",
      nested: { ok: true },
    });
  });

  test("parseCollectionIds trims and removes empty values", () => {
    expect(parseCollectionIds(" Syllabus_Table, ,Questions_Table ,, ")).toEqual([
      "Syllabus_Table",
      "Questions_Table",
    ]);
  });

  test("listAllDocuments paginates using cursor", async () => {
    const databases = {
      listDocuments: jest
        .fn()
        .mockResolvedValueOnce({
          documents: Array.from({ length: 100 }).map((_, idx) => ({ $id: `doc-${idx}` })),
        })
        .mockResolvedValueOnce({
          documents: [{ $id: "doc-100" }],
        }),
    };

    const docs = await listAllDocuments(databases, "examarchive", "Syllabus_Table");
    expect(docs).toHaveLength(101);
    expect(docs[0].$id).toBe("doc-0");
    expect(docs[100].$id).toBe("doc-100");
    expect(databases.listDocuments).toHaveBeenCalledTimes(2);
    expect(databases.listDocuments.mock.calls[1][2]).toContainEqual({
      type: "cursorAfter",
      value: "doc-99",
    });
  });

  test("upsertDocument updates when create returns already exists", async () => {
    const databases = {
      createDocument: jest.fn().mockRejectedValue({ code: 409 }),
      updateDocument: jest.fn().mockResolvedValue({}),
    };

    const result = await upsertDocument(databases, "examarchive", "Questions_Table", {
      $id: "doc-1",
      $updatedAt: "x",
      question_text: "Q1",
    });

    expect(result).toBe("updated");
    expect(databases.updateDocument).toHaveBeenCalledWith("examarchive", "Questions_Table", "doc-1", {
      question_text: "Q1",
    });
  });

  test("loadSyncConfig uses fallback production env vars and parses collection list", () => {
    const previousEnv = process.env;
    try {
      process.env = {
        ...previousEnv,
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
        APPWRITE_PROJECT_ID: "prod-project",
        APPWRITE_API_KEY: "prod-key",
        PREVIEW_APPWRITE_PROJECT_ID: "preview-project",
        PREVIEW_APPWRITE_API_KEY: "preview-key",
        CORE_SYNC_COLLECTIONS: "Syllabus_Table,Questions_Table",
      };

      const config = loadSyncConfig();
      expect(config.prod.projectId).toBe("prod-project");
      expect(config.preview.projectId).toBe("preview-project");
      expect(config.collectionIds).toEqual(["Syllabus_Table", "Questions_Table"]);
    } finally {
      process.env = previousEnv;
    }
  });
});
