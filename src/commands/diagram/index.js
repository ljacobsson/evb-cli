const program = require("commander");
const diagramBuilder = require("./diagram-builder");
const authHelper = require("../shared/auth-helper");

  program
  .command("diagram")
  .alias("d")
  .option(
    "-b, --eventbus [eventbus]",
    "Eventbus to create diagram for",
    "default"
  )
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .description("Builds an interactive diagram over an eventbus' rules ")
  .action(async (cmd) => {
    authHelper.initAuth(cmd);
    await diagramBuilder.build(cmd.eventbus);
  });
