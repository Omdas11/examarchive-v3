#!/usr/bin/env node

const { Client, Storage, Compression } = require("node-appwrite");
const { loadAppwriteEnv } = require("./appwrite-schema-setup");

const SYLLABUS_MD_INGESTION_BUCKET_ID =
  process.env.APPWRITE_SYLLABUS_MD_INGESTION_BUCKET_ID || "examarchive-syllabus-md-ingestion";
const QUESTION_INGESTION_ASSETS_BUCKET_ID =
  process.env.APPWRITE_QUESTION_INGESTION_ASSETS_BUCKET_ID || "examarchive-question-ingestion-assets";

function isNotFoundError(error) {
  const code = error?.code ?? error?.response?.code;
  return code === 404 || /not found/i.test(String(error?.message ?? ""));
}

function createStorageClient() {
  const { endpoint, projectId, apiKey } = loadAppwriteEnv();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Storage(client);
}

async function ensureBucket(storage, config) {
  const { bucketId, name, maximumFileSize, allowedFileExtensions } = config;
  try {
    await storage.getBucket({ bucketId });
    console.log(`[exists] bucket ${bucketId}`);
    return { bucketId, created: false };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await storage.createBucket({
    bucketId,
    name,
    permissions: [],
    fileSecurity: false,
    enabled: true,
    maximumFileSize,
    allowedFileExtensions,
    compression: Compression.None,
    encryption: true,
    antivirus: true,
    transformations: false,
  });
  console.log(`[create] bucket ${bucketId}`);
  return { bucketId, created: true };
}

async function ensureMdIngestionBucket() {
  const storage = createStorageClient();
  const results = await Promise.all([
    ensureBucket(storage, {
      bucketId: SYLLABUS_MD_INGESTION_BUCKET_ID,
      name: "examarchive-syllabus-md-ingestion",
      maximumFileSize: 2 * 1024 * 1024,
      allowedFileExtensions: ["md"],
    }),
    ensureBucket(storage, {
      bucketId: QUESTION_INGESTION_ASSETS_BUCKET_ID,
      name: "examarchive-question-ingestion-assets",
      maximumFileSize: 5 * 1024 * 1024,
      allowedFileExtensions: ["md", "pdf"],
    }),
  ]);
  return results;
}

if (require.main === module) {
  ensureMdIngestionBucket().catch((error) => {
    console.error("Failed to ensure ingestion bucket:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  SYLLABUS_MD_INGESTION_BUCKET_ID,
  QUESTION_INGESTION_ASSETS_BUCKET_ID,
  ensureMdIngestionBucket,
};
