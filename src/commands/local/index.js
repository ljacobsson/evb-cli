const program = require("commander");
const inputUtil = require("../shared/input-util");
const archiveUtil = require("../shared/archive-util");
const arnListener = require("./listeners/arnListener");
const localPatternListener = require("./listeners/localPatternListener");
const stackListener = require("./listeners/stackListener");
const authHelper = require("../shared/auth-helper");

const ruleDefault = "choose from template";
program
  .command("local")
  .alias("l")
  .option(
    "-s, --stack-name [stackName]",
    "Establishes local consumption of all rules in a stack"
  )
  .option("--arn [arn]", "Establishes local consumption of a rule ARN")
  .option(
    "-r, --rule [rule]",
    "Establishes local consumption of a rule in a local CloudFormation template",
    ruleDefault
  )
  .option("-c, --compact [compact]", "Output compact JSON on one line", false)
  .option("-sam, --sam-local [sam]", "Send requests to sam-local", false)
  .option(
    "-t, --template-file [sam]",
    "Path to template file. Only used together with --rule option",
    "template.yaml"
  )
  .option("-p, --profile [profile]", "AWS profile to use")
  .option(
    "--region [region]",
    "The AWS region to use. Falls back on AWS_REGION environment variable if not specified"
  )
  .option(
    "--replay",
    "Presents a UI for selecting archive and time range to replay"
  )
  .description("Initiates local consumption of a stack's EventBridge rules")
  .action(async (cmd) => {
    process.env.AWS_REGION = cmd.region || process.env.AWS_REGION;
    if (!process.env.AWS_REGION || process.env.AWS_REGION === "undefined") {
      console.error(
        "Missing required option: --region or AWS_REGION environment variable"
      );
      process.exit(1);
    }

    await authHelper.initAuth(cmd);
    let replayConfig;
    if (cmd.replay) {
      const eventbus = await inputUtil.getEventBusName();
      replayConfig = await archiveUtil.getReplayConfig({ eventbus: eventbus});
      replayConfig.EventBusName = eventbus;
    }

    if (cmd.stackName) {
      await stackListener.init(cmd.stackName, cmd.compact, cmd.samLocal);
      return;
    }
    if (cmd.arn) {
      await arnListener.init(cmd.arn, null, cmd.compact, cmd.samLocal);
      return;
    }
    if (cmd.rule) {
      await localPatternListener.init(
        cmd.rule === ruleDefault ? null : cmd.rule,
        cmd.templateFile,
        cmd.compact,
        cmd.samLocal,
        replayConfig
      );
      return;
    }
  });
