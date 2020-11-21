const AWS = require("aws-sdk");
const program = require("commander");
const browser = require("./browse-events");
const authHelper = require("../shared/auth-helper");

program
  .command("browse")
  .alias("b")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .description("Browses sources and detail types and shows their consumers")
  .action(async (cmd) => {
    authHelper.initAuth(cmd);
    const schemaApi = new AWS.Schemas();
    const evbApi = new AWS.EventBridge();
    await browser.browseEvents(cmd.format, schemaApi, evbApi);
  });
