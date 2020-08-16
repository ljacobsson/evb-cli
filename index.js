#!/usr/bin/env node
const patternBuilder = require("./pattern-builder");
const AWS = require("aws-sdk");
const program = require("commander");
const inputUtil = require("./input-util");
const iniFileLoader = require("@aws-sdk/shared-ini-file-loader");
require("@mhlabs/aws-sdk-sso");
new AWS.SingleSignOnCredentials().init();
program.version("1.0.15", "-v, --vers", "output the current version");
program
  .command("pattern")
  .alias("p")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option(
    "--sso",
    "Authenticate with AWS SSO. Set environment variable EVB_CLI_SSO=1 for default behaviour"
  )
  .description("Starts an EventBridge pattern builder")
  .action(async (cmd) => {
    const schemaApi = new AWS.Schemas();
    await patternBuilder.buildPattern(cmd.format, schemaApi);
  });

program
  .command("input")
  .alias("i")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option(
    "--sso",
    "Authenticate with AWS SSO. Set environment variable EVB_CLI_SSO=1 for default behaviour"
  )
  .description("Starts an EventBridge InputTransformer builder")
  .action(async (cmd) => {
    const schemaApi = new AWS.Schemas();
    await patternBuilder.buildInputTransformer(cmd.format, schemaApi);
  });

program
  .command("browse")
  .alias("b")
  .option("-p, --profile [profile]", "AWS profile to use")
  .description("Browses sources and detail types and shows their consumers")
  .action(async (cmd) => {
    const schemaApi = new AWS.Schemas();
    const evbApi = new AWS.EventBridge();
    await patternBuilder.browseEvents(cmd.format, schemaApi, evbApi);
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
