#!/usr/bin/env node
process.env.AWS_SDK_LOAD_CONFIG = 1;

const patternBuilder = require("./src/pattern-builder");
const diagramBuilder = require("./src/diagram-builder");
const AWS = require("aws-sdk");
const program = require("commander");
const templateParser = require("./src/template-parser");
const stackListener = require("./src/evb-local/listeners/stackListener");
const localPatternListener = require("./src/evb-local/listeners/localPatternListener");
const arnListener = require("./src/evb-local/listeners/arnListener");
const package = require('./package.json');
const eventTester = require("./src/event-tester");
const archiveUtil = require("./src/archive-util");
const inputUtil = require("./src/input-util");
require("@mhlabs/aws-sdk-sso");

program.version(package.version, "-v, --vers", "output the current version");
program
  .command("pattern")
  .alias("p")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("-t, --template [template]", "Path to template file", "template.yaml")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
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
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
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
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .description("Browses sources and detail types and shows their consumers")
  .action(async (cmd) => {
    initAuth(cmd);
    const schemaApi = new AWS.Schemas();
    const evbApi = new AWS.EventBridge();
    await patternBuilder.browseEvents(cmd.format, schemaApi, evbApi);
  });

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
    initAuth(cmd);
    await diagramBuilder.build(cmd.eventbus);
  });

  program
  .command("extract-sam-event")
  .alias("e")
  .option("-t, --template [template]", "Path to template file", "template.yaml")
  .description("Extracts an EventBusRule event from an AWS::Serverless::Function resource to an AWS::Events::Rule for more advanced use cases")
  .action(async (cmd) => {
    templateParser.load(cmd.template);
    await templateParser.extractSamDefinition();
  });

  program
  .command("test-event")
  .alias("t")
  .option("-e, --event-input-file [event-file]", "Path to test event", "event.json")
  .option("-n, --name-prefix [name-prefix]", "Name prefix for rules to test against fewer rules")
  .option("-b, --eventbus [eventbus]", "The eventbus to test against", "default")
  .option("-a, --all", "Show all rules, even unmatched ones", false)
  .description("Tests an event payload against existing rules on a bus")
  .action(async (cmd) => {
    initAuth(cmd);
    await eventTester.testEvent(cmd.eventInputFile, cmd.namePrefix, cmd.eventbus, cmd.all);
  });

  program
  .command("replay")
  .alias("r")
  .option("-b, --eventbus [eventbus]", "The eventbus the archive is stored against", "default")
  .option("-r, --rule-prefix [rulePrefix]", "Rule name prefix")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("-s, --replay-speed [speed]", "The speed of the replay in % where 0 == all at once and 100 == real time speed")
  .option("-n, --replay-name [name]", "The replay name", `evb-cli-replay-${new Date().getTime()}`)
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .description("Starts a replay of events against a specific destination")
  .action(async (cmd) => {
    initAuth(cmd);
    await archiveUtil.replay(cmd);
  });

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
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .option("--replay", "Presents a UI for selecting archive and time range to replay")
  .description("Initiates local consumption of a stack's EventBridge rules")
  .action(async (cmd) => {
    initAuth(cmd);
    let replayConfig;
    if(cmd.replay) {
      const eventbus = await inputUtil.getEventBusName(new AWS.EventBridge());
      replayConfig = await archiveUtil.getReplayConfig(eventbus);
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
function initAuth(cmd) {
  process.env.AWS_PROFILE = cmd.profile || process.env.AWS_PROFILE || "default";
  process.env.AWS_REGION = cmd.region || process.env.AWS_REGION;
  AWS.config.credentialProvider.providers.unshift(
    new AWS.SingleSignOnCredentials()
  );
}
