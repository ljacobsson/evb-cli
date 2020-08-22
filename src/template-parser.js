const fs = require("fs");
const YAML = require("./yaml-wrapper");
const AWS = require("aws-sdk");
const inputUtil = require("./input-util");
const patternBuilder = require("./pattern-builder");

let template;
let format;
let templatePath;
function load(filePath) {
  templatePath = filePath;
  try {
    const templateFile = fs.readFileSync(filePath);

    try {
      template = JSON.parse(templateFile.toString());
      format = "json";
      return;
    } catch (err) {}
    try {
      template = YAML.parse(templateFile.toString());
      format = "yaml";
      return;
    } catch (err) {
      console.log(err.message);
    }
  } catch (err) {
    console.log(
      `Could not find ${filePath}. Will write pattern to stdout. Use -t <path to CloudFormation template to write to template>`
    );
  }
}

function getFormattedResourceList(template) {
  return Object.keys(template.Resources)
    .map((p) => {
      return `[${template.Resources[p].Type}] ${p}`;
    })
    .sort();
}

function getLambdaFunctions() {
  return Object.keys(template.Resources)
    .filter((p) => template.Resources[p].Type === "AWS::Serverless::Function")
    .sort();
}

function getEventRules() {
  return Object.keys(template.Resources)
    .filter((p) => template.Resources[p].Type === "AWS::Events::Rule")
    .sort();
}

async function injectPattern(pattern) {
  const choices = [];
  const resources = [...getLambdaFunctions(), ...getEventRules()];
  for (const key of resources) {
    choices.push({
      name: key,
      value: { name: key, value: template.Resources[key] },
    });
  }

  const resource = await inputUtil.selectFrom(choices, "Add pattern to", true);
  if (resource.value.Type === "AWS::Serverless::Function") {
    const eventName = await inputUtil.text("Event name", "MyEvent");
    const eventBus = await inputUtil.getEventBusName(new AWS.EventBridge());
    if (!resource.value.Properties.Events) {
      resource.value.Properties.Events = {};
    }
    resource.value.Properties.Events[eventName] = {
      Type: "EventBridgeRule",
      Properties: {
        EventBusName: eventBus,
        Pattern: pattern,
      },
    };
    template.Resources[resource.name] = resource.value;
    fs.writeFileSync(
      templatePath,
      format === "json"
        ? JSON.stringify(template, null, 2)
        : YAML.stringify(template)
    );
  }
  if (resource.value.Type === "AWS::Events::Rule") {
    const eventBus = await inputUtil.getEventBusName(new AWS.EventBridge());
    if (!resource.value.Properties) {
      resource.value.Properties = {};
    }
    resource.value.Properties.EventPattern = pattern
    resource.value.Properties.EventBusName = eventBus
    template.Resources[resource.name] = resource.value;
    fs.writeFileSync(
      templatePath,
      format === "json"
        ? JSON.stringify(template, null, 2)
        : YAML.stringify(template)
    );
  }
}

module.exports = {
  getFormattedResourceList,
  getLambdaFunctions,
  load,
  injectPattern,
};
