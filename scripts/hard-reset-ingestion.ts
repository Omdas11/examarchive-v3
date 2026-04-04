import { Client, Databases, Storage, Permission, Role } from "node-appwrite";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);
const DB_ID = "examarchive";
const COL_ID = "ai_ingestions";
const BUCKET_ID = "examarchive-md-ingestion";

function isNotFoundError(error: unknown): boolean {
  const maybeError = error as { code?: number; response?: { code?: number; type?: string }; type?: string; message?: string };
  const code = maybeError?.code ?? maybeError?.response?.code;
  const type = maybeError?.type ?? maybeError?.response?.type;
  return code === 404 || type === "not_found" || type === "collection_not_found" || type === "bucket_not_found";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hardReset() {
  console.log("☢️ INITIATING HARD RESET OF INGESTION PIPELINE ☢️");

  try {
    await databases.deleteCollection(DB_ID, COL_ID);
    console.log(`Deleted old collection: ${COL_ID}`);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log(`Collection ${COL_ID} not found, proceeding...`);
  }

  await sleep(2000);

  const newCol = await databases.createCollection(
    DB_ID,
    COL_ID,
    "AI Ingestions",
    [Permission.read(Role.any())],
    false,
  );
  console.log(`✅ Recreated collection: ${newCol.$id}`);

  await databases.createStringAttribute(DB_ID, COL_ID, "paper_code", 255, true);
  await databases.createStringAttribute(DB_ID, COL_ID, "file_id", 255, true);
  console.log("✅ Created strict attributes: paper_code, file_id");

  try {
    await storage.deleteBucket(BUCKET_ID);
    console.log(`Deleted old bucket: ${BUCKET_ID}`);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log(`Bucket ${BUCKET_ID} not found, proceeding...`);
  }

  await sleep(2000);

  const newBucket = await storage.createBucket(
    BUCKET_ID,
    "MD Ingestion Cache",
    [Permission.read(Role.any())],
  );
  console.log(`✅ Recreated bucket: ${newBucket.$id}`);

  console.log("🎉 HARD RESET COMPLETE. Please run your standard sync script to update the MD docs.");
}

hardReset().catch((error) => {
  console.error("❌ Hard reset failed:", error);
  process.exit(1);
});
