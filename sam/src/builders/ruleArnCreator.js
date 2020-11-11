const AWS = require("aws-sdk");
const eventBridgeClient = require("./eventBridgeClient");
const cloudFormationClient = require("./cloudFormationClient");
const eventBridge = new AWS.EventBridge();

async function create(event) {
  const body = JSON.parse(event.body);
  const token = body.token;
  const ruleArn = body.ruleArn;
  const eventConsumerName = await cloudFormationClient.getEventConsumerName();
  const split = ruleArn.split("/");
  let busName;
  let ruleName;
  if (split.length == 2) {
    busName = "default";
    ruleName = split[1];
  } else {
    busName = split[1];
    ruleName = split[2];
  }
  const ruleNames = [];

  if (ruleName) {
    const ruleResponse = await eventBridge
      .describeRule({ EventBusName: busName, Name: ruleName })
      .promise();
    const ruleTargets = await eventBridge
      .listTargetsByRule({ EventBusName: busName, Rule: ruleResponse.Name })
      .promise();
    const newRuleName = eventBridgeClient.getRuleName(busName);
    ruleNames.push(newRuleName);
    if (body.replayName && ruleResponse.EventPattern) {
      const pattern = JSON.parse(ruleResponse.EventPattern);
      pattern["replay-name"] = [body.replayName];
      ruleResponse.EventPattern = JSON.stringify(pattern);
    }
    await eventBridgeClient.putRule(busName, ruleResponse, newRuleName);
    const targets = [];
    for (const target of ruleTargets.Targets) {
      const targetLogicalId = body.target || target.Arn || "Unknown target";

      targets.push(
        eventBridgeClient.createTarget(
          eventConsumerName,
          target,
          targetLogicalId,
          token
        )
      );
    }
    await eventBridgeClient.putTargets(busName, newRuleName, targets);
  }
  return ruleNames;
}

module.exports = {
  create,
};
