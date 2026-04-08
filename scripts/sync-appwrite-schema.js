#!/usr/bin/env node

const v2 = require("./v2/sync-appwrite-schema");

if (require.main === module) {
  v2.main().catch((error) => {
    console.error("Schema sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = v2;
