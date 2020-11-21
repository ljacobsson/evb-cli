#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;
const program = require("commander");
const package = require("./package.json");
require("@mhlabs/aws-sdk-sso");
require("./src/commands/pattern");
require("./src/commands/input");
require("./src/commands/browse");
require("./src/commands/diagram");
require("./src/commands/extract-sam-event");
require("./src/commands/test-event");
require("./src/commands/replay");
require("./src/commands/local");

program.version(package.version, "-v, --vers", "output the current version");

if (process.argv.length > 2) {
  // Renamed graph to diagram to be semantically correct. This is for backward compatibility
  if (process.argv[2] === "graph" || process.argv[2] === "g") {
    process.argv[2] = "diagram";
  }
}
program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
