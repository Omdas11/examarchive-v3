import { Client, Databases, Storage } from 'node-appwrite';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);
const DB_ID = 'examarchive';
const COL_ID = 'ai_ingestions';
const BUCKET_ID = 'examarchive-md-ingestion';

async function hardReset() {
    console.log("☢️ INITIATING HARD RESET OF INGESTION PIPELINE ☢️");

    // 1. NUKE & REBUILD COLLECTION
    try {
        await databases.deleteCollection(DB_ID, COL_ID);
        console.log(`Deleted old collection: ${COL_ID}`);
    } catch (e) { console.log(`Collection ${COL_ID} not found, proceeding...`); }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const newCol = await databases.createCollection(DB_ID, COL_ID, 'AI Ingestions');
    console.log(`✅ Recreated collection: ${newCol.$id}`);

    await databases.createStringAttribute(DB_ID, COL_ID, 'paper_code', 255, true);
    await databases.createStringAttribute(DB_ID, COL_ID, 'file_id', 255, true);
    console.log(`✅ Created strict attributes: paper_code, file_id`);

    // 2. NUKE & REBUILD BUCKET
    try {
        await storage.deleteBucket(BUCKET_ID);
        console.log(`Deleted old bucket: ${BUCKET_ID}`);
    } catch (e) { console.log(`Bucket ${BUCKET_ID} not found, proceeding...`); }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const newBucket = await storage.createBucket(BUCKET_ID, 'MD Ingestion Cache');
    console.log(`✅ Recreated bucket: ${newBucket.$id}`);
    
    console.log("🎉 HARD RESET COMPLETE. Please manually set permissions in the Appwrite Console.");
}
hardReset();
