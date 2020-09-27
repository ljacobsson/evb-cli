const eventBridgeClient = require("./eventBridgeClient");
const cloudFormationClient = require("./cloudFormationClient");

async function create(event) {
  const body = JSON.parse(event.body);
  const token = body.token;
  const localRule = body.localRule;

  const ruleName = eventBridgeClient.getRuleName(localRule.EventBusName);
  const eventConsumerName = await cloudFormationClient.getEventConsumerName();

  try {
    await eventBridgeClient.putRule(
      localRule.EventBusName,
      localRule,
      ruleName
    );
    console.log(eventConsumerName, localRule, body, token);
    const targets = [];
    if (localRule.Targets) {
      for (const target of localRule.Targets) {
        targets.push(
          eventBridgeClient.createTarget(
            eventConsumerName,
            target,
            body.targetId,
            token
          )
        );
      }
    } else {
      targets.push(
        eventBridgeClient.createTarget(
          eventConsumerName,
          localRule,
          localRule.Target,
          token
        )
      );
    }

    await eventBridgeClient.putTargets(
      localRule.EventBusName,
      ruleName,
      targets
    );
  } catch (err) {
    return { error: err };
  }

  return [ruleName];
}

module.exports = {
  create,
};
