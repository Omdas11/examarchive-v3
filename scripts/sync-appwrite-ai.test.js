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
        ["role:admin"],
        "node-20.0",
        undefined,
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
    });
  });
});
