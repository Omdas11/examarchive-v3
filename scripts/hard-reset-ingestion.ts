import { Client, Databases, Storage } from 'node-appwrite';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(path.resolve(__dirname, '..'));

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);
const DB_ID = 'examarchive';
const COL_ID = 'ai_ingestions';
const BUCKET_ID = 'examarchive-md-ingestion';

type IngestionAttribute =
    | { key: string; type: 'string'; size: number; required: boolean }
    | { key: string; type: 'integer'; required: boolean };

const INGESTION_ATTRIBUTES: IngestionAttribute[] = [
    { key: 'paper_code', type: 'string', size: 256, required: false },
    { key: 'source_label', type: 'string', size: 256, required: false },
    { key: 'file_id', type: 'string', size: 64, required: false },
    { key: 'file_url', type: 'string', size: 2048, required: false },
    { key: 'status', type: 'string', size: 32, required: false },
    { key: 'model', type: 'string', size: 64, required: false },
    { key: 'characters_ingested', type: 'integer', required: false },
    { key: 'digest', type: 'string', size: 8192, required: false },
];

function isNotFoundError(error: unknown): boolean {
    const maybeError = error as {
        code?: number;
        type?: string;
        message?: string;
        response?: { code?: number; type?: string };
    };
    const code = maybeError?.code ?? maybeError?.response?.code;
    const type = maybeError?.type ?? maybeError?.response?.type ?? '';
    const message = String(maybeError?.message ?? '');
    return code === 404 || /not found/i.test(message) || /_not_found$/.test(type);
}

async function createIngestionAttribute(attribute: IngestionAttribute) {
    if (attribute.type === 'string') {
        await databases.createStringAttribute(DB_ID, COL_ID, attribute.key, attribute.size, attribute.required);
        return;
    }
    await databases.createIntegerAttribute(DB_ID, COL_ID, attribute.key, attribute.required);
}

async function hardReset() {
    console.log("☢️ INITIATING HARD RESET OF INGESTION PIPELINE ☢️");

    // 1. NUKE & REBUILD COLLECTION
    try {
        await databases.deleteCollection(DB_ID, COL_ID);
        console.log(`Deleted old collection: ${COL_ID}`);
    } catch (e) {
        if (isNotFoundError(e)) {
            console.log(`Collection ${COL_ID} not found, proceeding...`);
        } else {
            console.error(`[hard-reset-ingestion] failed deleting collection ${COL_ID}:`, e);
            throw e;
        }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const newCol = await databases.createCollection(DB_ID, COL_ID, 'AI Ingestions');
    console.log(`✅ Recreated collection: ${newCol.$id}`);

    for (const attribute of INGESTION_ATTRIBUTES) {
        await createIngestionAttribute(attribute);
    }
    console.log(`✅ Created ingestion attributes`);

    // 2. NUKE & REBUILD BUCKET
    try {
        await storage.deleteBucket(BUCKET_ID);
        console.log(`Deleted old bucket: ${BUCKET_ID}`);
    } catch (e) {
        if (isNotFoundError(e)) {
            console.log(`Bucket ${BUCKET_ID} not found, proceeding...`);
        } else {
            console.error(`[hard-reset-ingestion] failed deleting bucket ${BUCKET_ID}:`, e);
            throw e;
        }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const newBucket = await storage.createBucket(BUCKET_ID, 'MD Ingestion Cache');
    console.log(`✅ Recreated bucket: ${newBucket.$id}`);
    
    console.log("🎉 HARD RESET COMPLETE. Please manually set permissions in the Appwrite Console.");
}
hardReset().catch((error) => {
    console.error('[hard-reset-ingestion] reset failed:', error);
    process.exitCode = 1;
});
