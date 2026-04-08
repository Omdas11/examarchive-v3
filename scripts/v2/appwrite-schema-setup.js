const path = require("path");
const { loadEnvConfig } = require("@next/env");

function loadAppwriteEnv() {
  loadEnvConfig(path.resolve(__dirname, "../.."));

  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing required Appwrite env vars. Ensure .env.local contains APPWRITE_API_KEY and endpoint/project values " +
        "(APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID or NEXT_PUBLIC_APPWRITE_ENDPOINT + NEXT_PUBLIC_APPWRITE_PROJECT_ID).",
    );
  }

  return { endpoint, projectId, apiKey };
}

function createAppwriteDatabasesClient() {
  const { Client, Databases } = require("node-appwrite");
  const { endpoint, projectId, apiKey } = loadAppwriteEnv();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Databases(client);
}

module.exports = {
  createAppwriteDatabasesClient,
  loadAppwriteEnv,
};
