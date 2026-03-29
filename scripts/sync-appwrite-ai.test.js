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
}));

jest.mock("./sync-appwrite-schema", () => ({
  ...jest.requireActual("./sync-appwrite-schema"),
  createAttribute: jest.fn().mockResolvedValue({}),
  waitForAttributeAvailability: jest.fn().mockResolvedValue({ status: "available" }),
}));

const { createAttribute, waitForAttributeAvailability } = require("./sync-appwrite-schema");
const { ensureFunctionExists, syncCollection } = require("./sync-appwrite-ai");

describe("sync-appwrite-ai", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ensureFunctionExists", () => {
    test("returns exists when function already present", async () => {
      const functions = {
        get: jest.fn().mockResolvedValue({ $id: "ai-admin-report" }),
        create: jest.fn(),
      };

      const result = await ensureFunctionExists(functions, {
        id: "ai-admin-report",
        name: "ai-admin-report",
        runtime: "node-20.0",
      });

      expect(result).toEqual({ functionId: "ai-admin-report", created: false });
      expect(functions.create).not.toHaveBeenCalled();
    });

    test("creates missing function with positional args expected by SDK", async () => {
      const functions = {
        get: jest.fn().mockRejectedValue({ code: 404 }),
        create: jest.fn().mockResolvedValue({}),
      };

      const func = {
        id: "ai-admin-report",
        name: "ai-admin-report",
        runtime: "node-20.0",
        execute: ["role:admin"],
        schedule: "0 2 * * 1",
      };

      const result = await ensureFunctionExists(functions, func);

      expect(result).toEqual({ functionId: "ai-admin-report", created: true });
      expect(functions.create).toHaveBeenCalledWith(
        "ai-admin-report",
        "ai-admin-report",
        "node-20.0",
        undefined,
        ["role:admin"],
        undefined,
        "0 2 * * 1",
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
          { key: "source_label", type: "string", required: false, size: 256 },
          { key: "status", type: "string", required: false, size: 32 },
        ],
      };

      const result = await syncCollection(databases, collection);

      expect(databases.createCollection).toHaveBeenCalledWith("examarchive", "ai_ingestions", "ai_ingestions");
      expect(createAttribute).toHaveBeenCalledTimes(1);
      expect(waitForAttributeAvailability).toHaveBeenCalledWith(
        databases,
        "examarchive",
        "ai_ingestions",
        "status",
      );
      expect(result).toEqual({
        collectionId: "ai_ingestions",
        createdCollection: true,
        createdAttributes: 1,
        totalTargetAttributes: 2,
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
          .mockResolvedValue({ attributes: [{ key: "source_label" }, { key: "status" }] }),
      };
      const collection = {
        id: "ai_ingestions",
        name: "ai_ingestions",
        attributes: [
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
  });
});
