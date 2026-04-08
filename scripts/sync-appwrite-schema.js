#!/usr/bin/env node

const v2 = require("./v2/sync-appwrite-schema");

function getObsoleteAttributes(collection, liveAttributes) {
  if (!Array.isArray(collection?.obsoleteAttributes) || collection.obsoleteAttributes.length === 0) {
    return [];
  }
  const obsoleteKeys = new Set(collection.obsoleteAttributes);
  return liveAttributes.filter((attribute) => obsoleteKeys.has(attribute.key));
}

if (require.main === module) {
  v2.main().catch((error) => {
    console.error("Schema sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  ...v2,
  getObsoleteAttributes,
};
