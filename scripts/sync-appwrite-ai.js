#!/usr/bin/env node

const v2 = require("./v2/sync-appwrite-ai");

if (require.main === module) {
  v2.main().catch((error) => {
    console.error("AI Appwrite sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = v2;
