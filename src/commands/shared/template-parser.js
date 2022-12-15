const fs = require("fs");
const YAML = require("./yaml-wrapper");
const AWS = require("aws-sdk");
const inputUtil = require("./input-util");
const inquirer = require("inquirer");

let template;
let format;
let templatePath;
function load(filePath, muteError) {
  templatePath = filePath;
  try {
    const templateFile = fs.readFileSync(filePath);

    try {
      template = JSON.parse(templateFile.toString());
      format = "json";
      return template;
    } catch (err) {}
    try {
      template = YAML.parse(templateFile.toString());
      format = "yaml";
      return template;
    } catch (err) {
      console.log("Can't find or parse " + templateFile.toString());
    }
  } catch (err) {
    if (!muteError) {
      console.log(
        `Could not find ${filePath}. Will write pattern to stdout. Use -t <path to CloudFormation template to write to template>`
      );
    }
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
  if (!template) {
    return;
  }
  const choices = [
    "Output to stdout",
    new inquirer.Separator("Compatible resources:"),
  ];
  const resources = [...getLambdaFunctions(), ...getEventRules()];
  for (const key of resources) {
    choices.push({
      name: key,
      value: { name: key, value: template.Resources[key] },
    });
  }

  const resource = await inputUtil.selectFrom(choices, "Add pattern to", true);
  if (resource === "Output to stdout") {
    console.log(
      format === "json"
        ? JSON.stringify(pattern, null, 2)
        : YAML.stringify(pattern)
    );
    return;
  }
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
    resource.value.Properties.EventPattern = pattern;
    resource.value.Properties.EventBusName = eventBus;
    template.Resources[resource.name] = resource.value;
    saveTemplate();
  }
}

function saveTemplate() {
  const replacer = (key, value) =>
  typeof value === 'undefined' ? null : value;
  fs.writeFileSync(
    templatePath,
    format === "json"
      ? JSON.stringify(template, replacer, 2)
      : YAML.stringify(template)
  );
}

function getSAMEvents(template) {
  const events = [];
  Object.keys(template.Resources).filter(
    (f) =>
      template.Resources[f].Type === "AWS::Serverless::Function" &&
      template.Resources[f].Properties.Events &&
      Object.keys(template.Resources[f].Properties.Events).forEach((e) => {
        if (
          template.Resources[f].Properties.Events[e].Type ===
            "EventBridgeRule" ||
          template.Resources[f].Properties.Events[e].Type === "CloudWatchEvent"
        ) {
          events.push({
            name: `${e} -> ${f}`,
            value: {
              function: f,
              event: e,
              config: template.Resources[f].Properties.Events[e].Properties,
            },
          });
        }
      })
  );
  return events;
}

function templateFormat() {
  return format;
}

module.exports = {
  getFormattedResourceList,
  getLambdaFunctions,
  getEventRules,
  load,
  injectPattern,
  saveTemplate,
  getSAMEvents,
  templateFormat,
};
