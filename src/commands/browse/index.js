const program = require("commander");
const browser = require("./browse-events");
const authHelper = require("../shared/auth-helper");

program
  .command("browse")
  .alias("b")
  .option("-f, --filter-patterns [filters]", "Comma separated list of '$.json.path.to.property=regex-pattern' to filter the results with")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .description("Browses sources and detail types and shows their consumers")
  .action(async (cmd) => {
    await authHelper.initAuth(cmd);
    await browser.browseEvents(cmd);
  });
