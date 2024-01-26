const program = require("commander");
const templateParser = require("../shared/template-parser");
const patternBuilder = require("./pattern-builder");
const authHelper = require("../shared/auth-helper");
program
  .command("pattern")
  .alias("p")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("-t, --template [template]", "Path to template file", "template.yaml")
  .option(
    "--region [region]",
    "The AWS region to use. Falls back on AWS_REGION environment variable if not specified"
  )
  .description("Starts an EventBridge pattern builder")
  .action(async (cmd) => {
    await authHelper.initAuth(cmd);
    templateParser.load(cmd.template);
    const pattern = await patternBuilder.buildPattern(cmd.format);
    await templateParser.injectPattern(pattern);
  });
