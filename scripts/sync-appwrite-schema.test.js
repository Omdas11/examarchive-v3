const {
  createAttribute,
  getMissingAttributes,
  renderSchemaStatusSection,
  upsertSchemaStatusBlock,
  waitForAttributeAvailability,
} = require("./sync-appwrite-schema");

describe("sync-appwrite-schema helpers", () => {
  test("getMissingAttributes returns only attributes not present live", () => {
    const target = [{ key: "email" }, { key: "role" }, { key: "xp" }];
    const live = [{ key: "email" }, { key: "xp" }];

    expect(getMissingAttributes(target, live)).toEqual([{ key: "role" }]);
  });

  test("createAttribute routes to matching Appwrite create method", async () => {
    const databases = {
      createStringAttribute: jest.fn().mockResolvedValue({}),
      createIntegerAttribute: jest.fn().mockResolvedValue({}),
      createBooleanAttribute: jest.fn().mockResolvedValue({}),
      createDatetimeAttribute: jest.fn().mockResolvedValue({}),
      createFloatAttribute: jest.fn().mockResolvedValue({}),
    };

    await createAttribute(databases, "examarchive", "users", {
      key: "email",
      type: "string",
      required: true,
      size: 320,
    });
    await createAttribute(databases, "examarchive", "users", {
      key: "xp",
      type: "integer",
      required: false,
    });
    await createAttribute(databases, "examarchive", "users", {
      key: "approved",
      type: "boolean",
      required: true,
      default: false,
    });
    await createAttribute(databases, "examarchive", "users", {
      key: "last_activity",
      type: "datetime",
      required: false,
    });
    await createAttribute(databases, "examarchive", "ai_embeddings", {
      key: "embedding",
      type: "float",
      required: true,
      array: true,
    });

    expect(databases.createStringAttribute).toHaveBeenCalled();
    expect(databases.createIntegerAttribute).toHaveBeenCalled();
    expect(databases.createBooleanAttribute).toHaveBeenCalled();
    expect(databases.createDatetimeAttribute).toHaveBeenCalled();
    expect(databases.createFloatAttribute).toHaveBeenCalled();
  });

  test("waitForAttributeAvailability waits until status is available", async () => {
    const databases = {
      getAttribute: jest
        .fn()
        .mockResolvedValueOnce({ status: "processing" })
        .mockResolvedValueOnce({ status: "available" }),
    };

    const attribute = await waitForAttributeAvailability(
      databases,
      "examarchive",
      "users",
      "email",
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(attribute.status).toBe("available");
    expect(databases.getAttribute).toHaveBeenCalledTimes(2);
  });

  test("renderSchemaStatusSection includes perfectly connected status", () => {
    const markdown = renderSchemaStatusSection([
      {
        collectionId: "papers",
        createdCollection: false,
        totalTargetAttributes: 21,
        createdAttributes: 0,
        mismatchCount: 0,
        connected: true,
      },
    ]);

    expect(markdown).toContain("✅ Perfectly connected");
    expect(markdown).toContain("`papers`");
    expect(markdown).not.toContain("Last sync:");
  });

  test("upsertSchemaStatusBlock inserts and replaces tagged section", () => {
    const base = "# Title\n\nSome text.\n";
    const inserted = upsertSchemaStatusBlock(base, "## Status A");
    expect(inserted).toContain("## Status A");

    const replaced = upsertSchemaStatusBlock(inserted, "## Status B");
    expect(replaced).toContain("## Status B");
    expect(replaced).not.toContain("## Status A");
  });
});
