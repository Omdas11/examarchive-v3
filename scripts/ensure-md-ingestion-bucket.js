#!/usr/bin/env node

const { Client, Storage, Compression } = require("node-appwrite");
const { loadAppwriteEnv } = require("./appwrite-schema-setup");

const MD_INGESTION_BUCKET_ID = process.env.APPWRITE_MD_INGESTION_BUCKET_ID || "examarchive-md-ingestion";

function isNotFoundError(error) {
  const code = error?.code ?? error?.response?.code;
  return code === 404 || /not found/i.test(String(error?.message ?? ""));
}

function createStorageClient() {
  const { endpoint, projectId, apiKey } = loadAppwriteEnv();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Storage(client);
}

async function ensureMdIngestionBucket() {
  const storage = createStorageClient();
  try {
    await storage.getBucket({ bucketId: MD_INGESTION_BUCKET_ID });
    console.log(`[exists] bucket ${MD_INGESTION_BUCKET_ID}`);
    return { bucketId: MD_INGESTION_BUCKET_ID, created: false };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await storage.createBucket({
    bucketId: MD_INGESTION_BUCKET_ID,
    name: "examarchive-md-ingestion",
    permissions: [],
    fileSecurity: false,
    enabled: true,
    maximumFileSize: 2 * 1024 * 1024,
    allowedFileExtensions: ["md"],
    compression: Compression.None,
    encryption: true,
    antivirus: true,
    transformations: false,
  });
  console.log(`[create] bucket ${MD_INGESTION_BUCKET_ID}`);
  return { bucketId: MD_INGESTION_BUCKET_ID, created: true };
}

if (require.main === module) {
  ensureMdIngestionBucket().catch((error) => {
    console.error("Failed to ensure ingestion bucket:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  MD_INGESTION_BUCKET_ID,
  ensureMdIngestionBucket,
};
