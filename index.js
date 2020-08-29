#!/usr/bin/env node
const patternBuilder = require("./src/pattern-builder");
const graphBuilder = require("./src/graph-builder");
const AWS = require("aws-sdk");
const program = require("commander");
const templateParser = require("./src/template-parser");
const stackListener = require("./src/evb-local/listeners/stackListener");
const localPatternListener = require("./src/evb-local/listeners/localPatternListener");
const arnListener = require("./src/evb-local/listeners/arnListener");

require("@mhlabs/aws-sdk-sso");
program.version("1.1.4", "-v, --vers", "output the current version");
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

program
  .command("graph")
  .alias("g")
  .option(
    "-b, --eventbus [eventbus]",
    "Eventbus to create graph for",
    "default"
  )
  .option("-p, --profile [profile]", "AWS profile to use")
  .description("Builds an interactive graph over an eventbus' rules ")
  .action(async (cmd) => {
    initAuth(cmd);
    await graphBuilder.build(cmd.eventbus);
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
    "template.yml"
  )
  .option("-p, --profile [profile]", "AWS profile to use")
  .description("Initiates local consumption of a stack's EventBridge rules")
  .action(async (cmd) => {
    initAuth(cmd);
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
        cmd.samLocal
      );
      return;
    }
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
