#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_DIR="${ROOT_DIR}/appwrite-functions/pdf-generator"
BUNDLE_PATH="${ROOT_DIR}/.tmp-pdf-generator-function.tgz"

: "${APPWRITE_ENDPOINT:?Missing APPWRITE_ENDPOINT}"
: "${APPWRITE_PROJECT_ID:?Missing APPWRITE_PROJECT_ID}"
: "${APPWRITE_API_KEY:?Missing APPWRITE_API_KEY}"
: "${GOTENBERG_URL:?Missing GOTENBERG_URL}"
: "${GOTENBERG_AUTH_TOKEN:?Missing GOTENBERG_AUTH_TOKEN}"
: "${GEMINI_API_KEY:?Missing GEMINI_API_KEY}"

FUNCTION_ID="${APPWRITE_PDF_GENERATOR_FUNCTION_ID:-pdf-generator}"
FUNCTION_NAME="${APPWRITE_PDF_GENERATOR_FUNCTION_NAME:-pdf-generator}"
FUNCTION_RUNTIME="${APPWRITE_FUNCTION_RUNTIME:-node-22.0}"
FUNCTION_TIMEOUT_SECONDS="${APPWRITE_FUNCTION_TIMEOUT_SECONDS:-300}"

if [[ ! -d "${FUNCTION_DIR}" ]]; then
  echo "Function directory not found: ${FUNCTION_DIR}" >&2
  exit 1
fi

echo "Packing function source from ${FUNCTION_DIR}..."
tar -czf "${BUNDLE_PATH}" -C "${FUNCTION_DIR}" .

echo "Deploying Appwrite function '${FUNCTION_ID}'..."
export FUNCTION_ID
export FUNCTION_NAME
export FUNCTION_RUNTIME
export FUNCTION_TIMEOUT_SECONDS
export BUNDLE_PATH
node <<'NODE'
const { Client, Functions } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const functionId = process.env.FUNCTION_ID;
const functionName = process.env.FUNCTION_NAME;
const runtime = process.env.FUNCTION_RUNTIME;
const timeoutSeconds = Number(process.env.FUNCTION_TIMEOUT_SECONDS || 300);
const bundlePath = process.env.BUNDLE_PATH;

const gotenbergUrl = process.env.GOTENBERG_URL;
const gotenbergAuthToken = process.env.GOTENBERG_AUTH_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;

const functionEnv = {
  GOTENBERG_URL: gotenbergUrl,
  GOTENBERG_AUTH_TOKEN: gotenbergAuthToken,
  GEMINI_API_KEY: geminiApiKey,
  APPWRITE_ENDPOINT: endpoint,
  APPWRITE_PROJECT_ID: projectId,
  APPWRITE_API_KEY: process.env.FUNCTION_APPWRITE_API_KEY || apiKey,
  DATABASE_ID: process.env.DATABASE_ID || "examarchive",
  AI_JOBS_COLLECTION_ID: process.env.AI_JOBS_COLLECTION_ID || "ai_generation_jobs",
  SYLLABUS_TABLE_COLLECTION_ID: process.env.SYLLABUS_TABLE_COLLECTION_ID || "Syllabus_Table",
  APPWRITE_BUCKET_ID: process.env.APPWRITE_BUCKET_ID || "papers",
};

function isNotFound(error) {
  return error?.code === 404 || error?.response?.code === 404 || error?.type === "function_not_found";
}

async function upsertFunction(functions) {
  try {
    const existing = await functions.get({ functionId });
    await functions.update({
      functionId,
      name: existing.name || functionName,
      runtime,
      execute: existing.execute || ["any"],
      timeout: timeoutSeconds,
      enabled: true,
      logging: true,
      entrypoint: "index.js",
      commands: "npm install --omit=dev",
    });
    return existing;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return functions.create({
      functionId,
      name: functionName,
      runtime,
      execute: ["any"],
      timeout: timeoutSeconds,
      enabled: true,
      logging: true,
      entrypoint: "index.js",
      commands: "npm install --omit=dev",
    });
  }
}

async function upsertVariables(functions) {
  const listed = await functions.listVariables({ functionId });
  const byKey = new Map((listed.variables || []).map((v) => [v.key, v]));
  for (const [key, value] of Object.entries(functionEnv)) {
    if (!value) continue;
    const secret = key === "GOTENBERG_AUTH_TOKEN" || key === "GEMINI_API_KEY" || key === "APPWRITE_API_KEY";
    const existing = byKey.get(key);
    if (existing) {
      await functions.updateVariable({
        functionId,
        variableId: existing.$id,
        key,
        value,
        secret,
      });
    } else {
      await functions.createVariable({
        functionId,
        key,
        value,
        secret,
      });
    }
  }
}

async function deployCode(functions) {
  const deployment = await functions.createDeployment({
    functionId,
    code: InputFile.fromPath(bundlePath, "pdf-generator-function.tgz"),
    activate: true,
    entrypoint: "index.js",
    commands: "npm install --omit=dev",
  });
  return deployment;
}

async function main() {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const functions = new Functions(client);
  await upsertFunction(functions);
  await upsertVariables(functions);
  const deployment = await deployCode(functions);
  console.log(JSON.stringify({
    ok: true,
    functionId,
    deploymentId: deployment.$id,
    timeoutSeconds,
  }, null, 2));
}

main().catch((error) => {
  console.error("[deploy-function] failed", error);
  process.exitCode = 1;
});
NODE

rm -f "${BUNDLE_PATH}"
echo "Done."
