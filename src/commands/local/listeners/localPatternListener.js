const fs = require("fs");
const utils = require("../utils");
const { v4: uuidv4 } = require("uuid");
const YAML = require("yaml-cfn");
const templateParser = require("../templateParser");
const websocket = require("./websocket");
const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
const intrinsicFunctions = [
  "Fn::Base64",
  "Fn::Cidr",
  "Fn::FindInMap",
  "Fn::GetAtt",
  "Fn::GetAZs",
  "Fn::ImportValue",
  "Fn::Join",
  "Fn::Select",
  "Fn::Split",
  "Fn::Sub",
  "Fn::Transform",
  "Ref",
];
let output = console;
function findAllKeys(obj, keyArray) {
  keyArray.push(...Object.keys(obj));
  for (const prop of Object.keys(obj)) {
    if (
      !obj[prop] ||
      typeof obj[prop] !== "object" ||
      typeof obj[prop] === "string" ||
      obj[prop] instanceof String
    ) {
      return;
    }
    if (Array.isArray(obj[prop])) {
      obj[prop].forEach((child) => findAllKeys(child, keyArray));
    } else {
      findAllKeys(obj[prop], keyArray);
    }
  }
}

async function initLocalPatternListener(
  ruleName,
  templateFile,
  compact,
  sam,
  replaySettings
) {
  let templateString = "";
  try {
    templateString = fs.readFileSync(templateFile);
  } catch {
    output.log(
      `Can't find ${templateFile}. Specify location with -t flag, for example 'evb-local test-rule -t serverless.template'`
    );
    process.exit(1);
  }
  const parser = utils.isJson(templateString) ? JSON.parse : YAML.yamlParse;
  template = parser(templateString);

  let rule;
  let rules = [];
  for (const resourceKey of Object.keys(template.Resources)) {
    const resource = template.Resources[resourceKey];
    templateParser.handleSAMResource(resource, rules, resourceKey, replaySettings);
    templateParser.handleEventsRule(resource, rules, resourceKey, replaySettings);
    rules = rules.sort((a, b) => a.Name > b.Name);
  }
  if (ruleName) {
    rule = rules.filter((r) => r.Name === `${ruleName}->${target}`)[0];
  } else {
    var ruleResponse = await prompt({
      name: "rule",
      type: "list",
      message: "Select rule",
      choices: rules.map((p) => {
        return { name: p.Name, value: p };
      }),
    });
    rule = ruleResponse.rule;
  }
  await initConnection(rule, ruleName, compact, sam, null, null, replaySettings);
}

async function initConnection(
  rule,
  ruleName,
  compact,
  sam,
  cloudFormationClient,
  output,
  replaySettings
) {
  output = output || console;
  const keyArray = [];
  if (typeof rule.EventPattern === "object") {
    findAllKeys(rule.EventPattern, keyArray);
  } else {
    findAllKeys(JSON.parse(rule.EventPattern), keyArray);
  }

  for (const func of intrinsicFunctions) {
    if (keyArray.includes(func)) {
      output.error(
        `Your pattern includes an intrinsic function [${func}]. The current version of evb-local can't handle this.`
      );
      return;
    }
  }

  const token = uuidv4();
  websocket.connect(
    `wss://${await websocket.apiId()}.execute-api.${
      process.env.AWS_REGION
    }.amazonaws.com/Prod`,
    token,
    ruleName,
    compact,
    sam,
    rule,
    null,
    null,
    output,
    replaySettings
  );
  output.log("Connecting...");
}

function disconnect() {
  websocket.disconnect();
}

module.exports = {
  init: initLocalPatternListener,
  disconnect,
  initConnection,
};
