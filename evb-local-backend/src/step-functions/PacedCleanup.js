const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge();
const eventBusName = "evb-cli-replaybus";
exports.handler = async function (event, context) {
  for (const rule of event.Rules) {
    const bus = rule.endsWith("dispatch") ? eventBusName : event.EventBusName;
    const targets = await eventbridge
      .listTargetsByRule({
        EventBusName: bus,
        Rule: rule,
      })
      .promise();
    await eventbridge
      .removeTargets({
        Ids: targets.Targets.map((p) => p.Id),
        Rule: rule,
        EventBusName: bus,
      })
      .promise();
    await eventbridge.deleteRule({ EventBusName: bus, Name: rule }).promise();
  }
};
