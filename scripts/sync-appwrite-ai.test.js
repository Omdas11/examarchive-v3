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
  Functions: jest.fn(),
  InputFile: {
    fromPath: jest.fn().mockReturnValue({ __file: true }),
  },
}));

jest.mock("./v2/sync-appwrite-schema", () => ({
  ...jest.requireActual("./v2/sync-appwrite-schema"),
  createAttribute: jest.fn().mockResolvedValue({}),
  waitForAttributeAvailability: jest.fn().mockResolvedValue({ status: "available" }),
}));

const { createAttribute, waitForAttributeAvailability } = require("./v2/sync-appwrite-schema");
const {
  ensureFunctionExists,
  syncCollection,
  assertRequiredFunctionsSynced,
  resolveWorkerVariables,
} = require("./v2/sync-appwrite-ai");

describe("sync-appwrite-ai", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("ensureFunctionExists", () => {
    test("returns exists when function already present", async () => {
      const functions = {
        get: jest.fn().mockResolvedValue({ $id: "ai-admin-report" }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      };

      const result = await ensureFunctionExists(functions, {
        id: "ai-admin-report",
        name: "ai-admin-report",
        runtime: "node-20.0",
      });

      expect(result).toEqual({ functionId: "ai-admin-report", created: false, runtime: "node-20.0" });
      expect(functions.create).not.toHaveBeenCalled();
      expect(functions.update).toHaveBeenCalledWith(
        "ai-admin-report",
        "ai-admin-report",
        "node-20.0",
        [],
        undefined,
        undefined,
        undefined,
        true,
        true,
        undefined,
        undefined,
      );
    });

    test("creates missing function with positional args expected by SDK", async () => {
      const functions = {
        get: jest.fn().mockRejectedValue({ code: 404 }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      };

      const func = {
        id: "ai-admin-report",
        name: "ai-admin-report",
        runtime: "node-20.0",
        execute: ["role:admin"],
        schedule: "0 2 * * 1",
      };

      const result = await ensureFunctionExists(functions, func);

      expect(result).toEqual({ functionId: "ai-admin-report", created: true, runtime: "node-20.0" });
      expect(functions.create).toHaveBeenCalledWith(
        "ai-admin-report",
        "ai-admin-report",
        "node-20.0",
        ["role:admin"],
        undefined,
        "0 2 * * 1",
        undefined,
        true,
        true,
        undefined,
        undefined,
      );
    });
  
    test("retries with fallback runtime when preferred runtime is unavailable", async () => {
      const functions = {
        get: jest.fn().mockRejectedValue({ code: 404 }),
        create: jest
          .fn()
          .mockRejectedValueOnce({ type: "runtime_not_found", message: "Runtime not found" })
          .mockResolvedValueOnce({}),
        update: jest.fn(),
      };

      const func = {
        id: "ai-note-worker",
        name: "ai-note-worker",
        runtime: "node-22.0",
        execute: ["any"],
      };

      const result = await ensureFunctionExists(functions, func);

      expect(result).toEqual({ functionId: "ai-note-worker", created: true, runtime: "node-20.0" });
      expect(functions.create).toHaveBeenNthCalledWith(
        1,
        "ai-note-worker",
        "ai-note-worker",
        "node-22.0",
        ["any"],
        undefined,
        undefined,
        undefined,
        true,
        true,
        undefined,
        undefined,
      );
      expect(functions.create).toHaveBeenNthCalledWith(
        2,
        "ai-note-worker",
        "ai-note-worker",
        "node-20.0",
        ["any"],
        undefined,
        undefined,
        undefined,
        true,
        true,
        undefined,
        undefined,
      );
    });
  });

  describe("resolveWorkerVariables", () => {
    test("uses explicit AI worker env overrides", () => {
      process.env.APPWRITE_AI_WORKER_BASE_URL = "https://example.com/";
      process.env.APPWRITE_AI_WORKER_SHARED_SECRET = "worker-secret";

      const vars = resolveWorkerVariables();

      expect(vars).toEqual([
        { key: "EXAMARCHIVE_BASE_URL", value: "https://example.com", secret: false },
        { key: "EXAMARCHIVE_WORKER_SHARED_SECRET", value: "worker-secret", secret: true },
      ]);
    });

    test("throws when worker shared secret is missing", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://www.examarchive.dev/";
      delete process.env.APPWRITE_AI_WORKER_SHARED_SECRET;
      delete process.env.APPWRITE_WORKER_SHARED_SECRET;

      expect(() => resolveWorkerVariables()).toThrow(
        "Missing APPWRITE_AI_WORKER_SHARED_SECRET/APPWRITE_WORKER_SHARED_SECRET",
      );
    });
  });

  describe("syncCollection", () => {
    test("creates collection and missing attributes", async () => {
      const databases = {
        getCollection: jest.fn().mockRejectedValue({ code: 404 }),
        createCollection: jest.fn().mockResolvedValue({}),
        listAttributes: jest.fn().mockResolvedValue({ attributes: [{ key: "source_label" }] }),
      };
      const collection = {
        id: "ai_ingestions",
        name: "ai_ingestions",
        attributes: [
          { key: "paper_code", type: "string", required: false, size: 256 },
          { key: "source_label", type: "string", required: false, size: 256 },
          { key: "status", type: "string", required: false, size: 32 },
        ],
      };

      const result = await syncCollection(databases, collection);

      expect(databases.createCollection).toHaveBeenCalledWith("examarchive", "ai_ingestions", "ai_ingestions");
      expect(createAttribute).toHaveBeenCalledTimes(2);
      expect(waitForAttributeAvailability).toHaveBeenCalledWith(
        databases,
        "examarchive",
        "ai_ingestions",
        "status",
      );
      expect(result).toEqual({
        collectionId: "ai_ingestions",
        createdCollection: true,
        createdAttributes: 2,
        totalTargetAttributes: 3,
        connected: false,
        attributeLimitExceeded: false,
      });
    });

    test("marks connected when collection exists and no missing attributes", async () => {
      const databases = {
        getCollection: jest.fn().mockResolvedValue({ $id: "ai_ingestions" }),
        createCollection: jest.fn(),
        listAttributes: jest
          .fn()
          .mockResolvedValue({ attributes: [{ key: "paper_code" }, { key: "source_label" }, { key: "status" }] }),
      };
      const collection = {
        id: "ai_ingestions",
        name: "ai_ingestions",
        attributes: [
          { key: "paper_code", type: "string", required: false, size: 256 },
          { key: "source_label", type: "string", required: false, size: 256 },
          { key: "status", type: "string", required: false, size: 32 },
        ],
      };

      const result = await syncCollection(databases, collection);

      expect(databases.createCollection).not.toHaveBeenCalled();
      expect(createAttribute).not.toHaveBeenCalled();
      expect(result.connected).toBe(true);
      expect(result.createdAttributes).toBe(0);
      expect(result.createdCollection).toBe(false);
      expect(result.attributeLimitExceeded).toBe(false);
    });

    test("skips remaining attributes when Appwrite reports attribute_limit_exceeded", async () => {
      const databases = {
        getCollection: jest.fn().mockResolvedValue({ $id: "ai_admin_reports" }),
        createCollection: jest.fn(),
        listAttributes: jest.fn().mockResolvedValue({ attributes: [] }),
      };
      createAttribute
        .mockImplementationOnce(() => Promise.resolve({}))
        .mockRejectedValueOnce({ type: "attribute_limit_exceeded" });

      const collection = {
        id: "ai_admin_reports",
        name: "ai_admin_reports",
        attributes: [
          { key: "run_at", type: "datetime", required: false },
          { key: "summary", type: "string", required: false, size: 10000 },
          { key: "risks_json", type: "string", required: false, size: 10000 },
        ],
      };

      const result = await syncCollection(databases, collection);

      expect(result).toEqual({
        collectionId: "ai_admin_reports",
        createdCollection: false,
        createdAttributes: 1,
        totalTargetAttributes: 3,
        connected: false,
        attributeLimitExceeded: true,
      });
      expect(waitForAttributeAvailability).toHaveBeenCalledTimes(1);
    });

    test("continues when Appwrite reports attribute_already_exists", async () => {
      const databases = {
        getCollection: jest.fn().mockResolvedValue({ $id: "ai_generation_jobs" }),
        createCollection: jest.fn(),
        listAttributes: jest.fn().mockResolvedValue({ attributes: [] }),
      };
      createAttribute
        .mockRejectedValueOnce({ type: "attribute_already_exists", code: 409, message: "already exists" })
        .mockResolvedValueOnce({});

      const collection = {
        id: "ai_generation_jobs",
        name: "ai_generation_jobs",
        attributes: [
          { key: "result_note_id", type: "string", required: false, size: 64 },
          { key: "error_message", type: "string", required: false, size: 2000 },
        ],
      };

      const result = await syncCollection(databases, collection);

      expect(result).toEqual({
        collectionId: "ai_generation_jobs",
        createdCollection: false,
        createdAttributes: 1,
        totalTargetAttributes: 2,
        connected: false,
        attributeLimitExceeded: false,
      });
      expect(waitForAttributeAvailability).toHaveBeenNthCalledWith(
        1,
        databases,
        "examarchive",
        "ai_generation_jobs",
        "result_note_id",
      );
      expect(waitForAttributeAvailability).toHaveBeenNthCalledWith(
        2,
        databases,
        "examarchive",
        "ai_generation_jobs",
        "error_message",
      );
    });
  });

  describe("assertRequiredFunctionsSynced", () => {
    test("passes when ai-note-worker is present", () => {
      expect(() =>
        assertRequiredFunctionsSynced([
          { functionId: "ai-note-worker", created: true, runtime: "node-22.0" },
          { functionId: "ai-admin-report", created: false, runtime: "node-22.0" },
        ]),
      ).not.toThrow();
    });

    test("throws when ai-note-worker is missing", () => {
      expect(() =>
        assertRequiredFunctionsSynced([{ functionId: "ai-admin-report", created: true, runtime: "node-22.0" }]),
      ).toThrow('Required AI function "ai-note-worker" was not synced');
    });
  });
});
