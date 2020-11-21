const AWS = require("aws-sdk");
const eventBridgeClient = require("./eventBridgeClient");
const cloudFormationClient = require("./cloudFormationClient");
const eventBridge = new AWS.EventBridge();

async function create(event) {
  const body = JSON.parse(event.body);
  const token = body.token;
  const stackName = body.stack;
  const eventConsumerName = await cloudFormationClient.getEventConsumerName();
  const stackResourcesResponse = await cloudFormationClient.getStackResources(
    stackName
  );
  const ruleNames = [];
  for (const resource of stackResourcesResponse.StackResourceSummaries.filter(
    (p) => p.ResourceType.startsWith("AWS::Events::Rule")
  )) {
    const busName = resource.PhysicalResourceId.split("|")[0];
    const ruleName = resource.PhysicalResourceId.split("|")[1];
    if (ruleName) {
      const ruleResponse = await eventBridge
        .describeRule({ EventBusName: busName, Name: ruleName })
        .promise();
      const ruleTargets = await eventBridge
        .listTargetsByRule({ EventBusName: busName, Rule: ruleResponse.Name })
        .promise();
      const newRuleName = eventBridgeClient.getRuleName(busName);
      ruleNames.push(newRuleName);
      if (body.replayName) {
        ruleResponse.EventPattern["replay-name"] =
          body.replaySettings.ReplayName;
      }
      await eventBridgeClient.putRule(busName, ruleResponse, newRuleName);
      const targets = [];
      for (const target of ruleTargets.Targets) {
        const targetPhysicalId = target.Arn.split(":").slice(-1)[0];
        const targetLogicalIds = stackResourcesResponse.StackResourceSummaries.filter(
          (p) => p.PhysicalResourceId === targetPhysicalId
        );
        const targetLogicalId =
          targetLogicalIds && targetLogicalIds.length
            ? targetLogicalIds[0].LogicalResourceId
            : targetPhysicalId || "Unknown target";

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
  }
  return ruleNames;
}

module.exports = {
  create,
};
