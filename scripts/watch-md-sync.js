#!/usr/bin/env node

const v2 = require("./v2/watch-md-sync");

if (require.main === module) {
  v2.startWatcher();
}

module.exports = v2;
