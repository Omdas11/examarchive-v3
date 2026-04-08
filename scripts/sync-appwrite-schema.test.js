const {
  createAttribute,
  getAppwriteDefaultValue,
  getMissingAttributes,
  isAttributeAlreadyExistsError,
  renderSchemaStatusSection,
  syncCollection,
  TARGET_SCHEMA,
  upsertSchemaStatusBlock,
  waitForAttributeAvailability,
} = require("./v2/sync-appwrite-schema");

describe("sync-appwrite-schema helpers", () => {
  test("getMissingAttributes returns only attributes not present live", () => {
    const target = [{ key: "email" }, { key: "role" }, { key: "xo" }];
    const live = [{ key: "email" }, { key: "xo" }];

    expect(getMissingAttributes(target, live)).toEqual([{ key: "role" }]);
  });

  test("createAttribute routes to matching Appwrite create method", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
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
      key: "xo",
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
    expect(databases.createBooleanAttribute).toHaveBeenCalledWith(
      "examarchive",
      "users",
      "approved",
      true,
      undefined,
      false,
    );
    warnSpy.mockRestore();
  });

  test("getAppwriteDefaultValue omits default for required attributes", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(getAppwriteDefaultValue("users", { key: "approved", required: true, default: false })).toBeUndefined();
    expect(getAppwriteDefaultValue("users", { key: "approved", required: false, default: false })).toBe(false);
    expect(getAppwriteDefaultValue("users", { key: "status", required: false, default: "pending" })).toBe(
      "pending",
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  test("getAppwriteDefaultValue warns when required attributes declare defaults", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const value = getAppwriteDefaultValue("feedback", { key: "approved", required: true, default: false });
    expect(value).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[warn] feedback.approved defines a default but is required. " +
        "Appwrite does not allow defaults on required attributes, so the default is omitted.",
    );
    warnSpy.mockRestore();
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

  test("isAttributeAlreadyExistsError detects duplicate attribute errors", () => {
    expect(isAttributeAlreadyExistsError({ code: 409, message: "Attribute already exists" })).toBe(true);
    expect(isAttributeAlreadyExistsError({ code: 409, message: "Attribute already exist" })).toBe(true);
    expect(isAttributeAlreadyExistsError({ type: "attribute_already_exists" })).toBe(true);
    expect(
      isAttributeAlreadyExistsError({ code: 409, message: "Attribute with the requested key already exists" }),
    ).toBe(true);
    expect(
      isAttributeAlreadyExistsError({
        response: { code: 409, message: "Attribute with the requested key already exist" },
      }),
    ).toBe(true);
    expect(isAttributeAlreadyExistsError({ code: 500, message: "Unexpected error" })).toBe(false);
    expect(isAttributeAlreadyExistsError({ code: 409, message: "Permission denied" })).toBe(false);
  });

  test("syncCollection tolerates duplicate-create race and continues", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const databases = {
      getCollection: jest.fn().mockResolvedValue({ $id: "demo" }),
      listAttributes: jest.fn().mockResolvedValue({ attributes: [] }),
      createStringAttribute: jest.fn().mockRejectedValue({ code: 409, type: "attribute_already_exists" }),
      getAttribute: jest.fn().mockResolvedValue({ status: "available" }),
    };

    const result = await syncCollection(databases, "examarchive", {
      id: "demo",
      name: "demo",
      attributes: [{ key: "status", type: "string", required: false, size: 32 }],
    });

    expect(result.createdAttributes).toBe(0);
    expect(databases.createStringAttribute).toHaveBeenCalledTimes(1);
    expect(databases.getAttribute).toHaveBeenCalledWith("examarchive", "demo", "status");
    expect(warnSpy).toHaveBeenCalledWith(
      "[warn] demo.status already exists while creating. Proceeding to wait for attribute availability.",
    );
    warnSpy.mockRestore();
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

  test("TARGET_SCHEMA includes stream attribute in ingestion tables", () => {
    const syllabus = TARGET_SCHEMA.find((collection) => collection.id === "Syllabus_Table");
    const questions = TARGET_SCHEMA.find((collection) => collection.id === "Questions_Table");
    expect(syllabus).toBeDefined();
    expect(questions).toBeDefined();
    expect(syllabus.attributes.some((attribute) => attribute.key === "stream")).toBe(true);
    expect(questions.attributes.some((attribute) => attribute.key === "stream")).toBe(true);
    expect(syllabus.attributes.some((attribute) => attribute.key === "entry_id")).toBe(true);
    expect(syllabus.attributes.some((attribute) => attribute.key === "semester_code")).toBe(true);
    expect(questions.attributes.some((attribute) => attribute.key === "question_id")).toBe(true);
    expect(questions.attributes.some((attribute) => attribute.key === "exam_year")).toBe(true);
  });
});
