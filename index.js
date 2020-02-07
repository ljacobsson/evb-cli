#!/usr/bin/env node
const patternBuilder = require("./pattern-builder");
const codeBinding = require("./code-binding");
const program = require("commander");
program.version('1.0.0', '-v, --vers', 'output the current version');
program
.command("pattern")
.alias("p")
.option('-f, --format <json|yaml>', 'Select output format', 'json')
.description("Starts an EventBridge pattern builder")
.action(async (cmd) => {
  await patternBuilder.buildPattern(cmd.format);
});
// Commenting this out sinc ethere seems to be an SDK bug with getting code bindings 
//
// program
// .command("code-bindings")
// .alias("c")
// .description("Get code bindinng for a schema")
// .action(async () => {
//   await codeBinding.browse();
// });

program.parse(process.argv);
