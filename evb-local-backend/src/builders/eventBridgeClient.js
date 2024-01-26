const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const eventBridge = new AWS.EventBridge();

async function putRule(busName, input, ruleName) {
  await eventBridge
    .putRule({
      EventBusName: busName,
      EventPattern: input.EventPattern,
      Name: ruleName,
      State: "ENABLED",
      ScheduleExpression: input.ScheduleExpression,
    })
    .promise();
}

async function putTargets(busName, ruleName, targets) {
  await eventBridge
    .putTargets({
      EventBusName: busName,
      Rule: ruleName,
      Targets: targets,
    })
    .promise();
}

function createTarget(eventConsumerName, target, targetLogicalId, token) {
  const t = {
    Id: `${eventConsumerName}-${uuidv4()}`.substring(0, 64),
    Arn: `arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AccountId}:function:${eventConsumerName}`,
    Input: target.Input,
    InputPath: target.InputPath,
  };
  if (target.InputTransformer) {
    t.InputTransformer = target.InputTransformer;
    t.InputTransformer.InputTemplate =
      `{ \"Target\": \"${targetLogicalId}\", \"Token\": \"${token}\", \"Body\": ` +
      target.InputTransformer.InputTemplate +
      "}";
  } else {
    t.InputTransformer = {
      InputPathsMap: { Body: t.InputPath || "$" },
      InputTemplate: `{ "Target": "${targetLogicalId}", "Token": "${token}", "Body": <Body> }`,
    };
    if (t.InputPath) {
      t.InputPath = null;
    }
  }
  return t;
}

function getRuleName(busName) {
  return `evb-local-${busName
    .replace(/\//g, "-")
    .substring(0, 30)}-${new Date().getTime()}`;
}

module.exports = {
  putRule,
  createTarget,
  putTargets,
  getRuleName,
};
