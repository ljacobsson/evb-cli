#!/usr/bin/env node
const patternBuilder = require("./src/pattern-builder");
const AWS = require("aws-sdk");
const program = require("commander");
const templateParser = require("./src/template-parser");
require("@mhlabs/aws-sdk-sso");
program.version("1.0.18", "-v, --vers", "output the current version");
program
  .command("pattern")
  .alias("p")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("-t, --template [template]", "Path to template file", "template.yml")
  .description("Starts an EventBridge pattern builder")
  .action(async (cmd) => {
    initAuth(cmd);
    templateParser.load(cmd.template);
    const schemaApi = new AWS.Schemas();
    const pattern = await patternBuilder.buildPattern(cmd.format, schemaApi);
    await templateParser.injectPattern(pattern);
  });

program
  .command("input")
  .alias("i")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-p, --profile [profile]", "AWS profile to use")
  .description("Starts an EventBridge InputTransformer builder")
  .action(async (cmd) => {
    initAuth(cmd);
    const schemaApi = new AWS.Schemas();
    await patternBuilder.buildInputTransformer(cmd.format, schemaApi);
  });

program
  .command("browse")
  .alias("b")
  .option("-p, --profile [profile]", "AWS profile to use")
  .description("Browses sources and detail types and shows their consumers")
  .action(async (cmd) => {
    initAuth(cmd);
    const schemaApi = new AWS.Schemas();
    const evbApi = new AWS.EventBridge();
    await patternBuilder.browseEvents(cmd.format, schemaApi, evbApi);
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
function initAuth(cmd) {
  process.env.AWS_PROFILE = cmd.profile || process.env.AWS_PROFILE || "default";
  AWS.config.credentialProvider.providers.unshift(
    new AWS.SingleSignOnCredentials()
  );
}

