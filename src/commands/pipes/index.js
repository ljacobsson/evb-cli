const program = require("commander");
const pipeBuilder = require("./pipe-builder");

program
  .command("pipes")
  .alias("pi")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("-t, --template [template]", "Path to template file", "template.yaml")
  .option("-g, --guided", "Run in guided mode - prompts for all optional parameters")
  .option(
    "--region [region]",
    "The AWS region to use. Falls back on AWS_REGION environment variable if not specified"
  )
  .description("Connects two compatible resources in your template via EventBridge Pipes")
  .action(async (cmd) => {
    await pipeBuilder.build(
      cmd
    );
  });
