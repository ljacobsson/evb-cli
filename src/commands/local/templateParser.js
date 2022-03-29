const { replay } = require("../shared/archive-util");

function handleSAMResource(resource, rules, resourceKey, replaySettings) {
  if (
    (resource.Type === "AWS::Serverless::Function" || resource.Type === "AWS::Serverless::StateMachine") &&
    resource.Properties &&
    resource.Properties.Events
  ) {
    for (const eventKey of Object.keys(resource.Properties.Events)) {
      const event = resource.Properties.Events[eventKey];
      if (
        event.Type === "EventBridgeRule" ||
        event.Type === "CloudWatchEvent"
      ) {
        if (replaySettings) {
          event.Properties.Pattern["replay-name"] = [replaySettings.ReplayName];
        }
    
        rules.push({
          Target: resourceKey,
          Name: `${eventKey} -> ${resourceKey}`,
          EventBusName: event.Properties.EventBusName || "default",
          InputPath: event.Properties.InputPath,
          Input: event.Properties.Input,
          EventPattern: JSON.stringify(event.Properties.Pattern),
        });
      }
    }
  }
}

function handleEventsRule(resource, rules, resourceKey, replaySettings) {
  if (resource.Type === "AWS::Events::Rule" && resource.Properties) {
    if (replaySettings) {
      resource.Properties.EventPattern["replay-name"] = [replaySettings.ReplayName];
    }
    const rule = {
      EventPattern: JSON.stringify(resource.Properties.EventPattern),
      EventBusName: resource.Properties.EventBusName || "default",
    };

    for (const target of resource.Properties.Targets) {
      let targetName = "";
      if (Object.keys(target.Arn)[0].includes("GetAtt")) {
        targetName = target.Arn[Object.keys(target.Arn)[0]][0];
      } else if (Object.keys(target.Arn)[0].includes("Ref")) {
        targetName = target.Arn[Object.keys(target.Arn)[0]];
      } else {
        targetName = target.Arn.split(":").slice(-1)[0];
      }
      rule.Target = targetName;
      rules.push({
        ...rule,
        Name: `${resourceKey} -> ${targetName}`,
        InputPath: target.InputPath,
        Input: target.Input,
        InputTransformer: target.InputTransformer,
      });
    }
  }
}

module.exports = {
  handleEventsRule,
  handleSAMResource,
};
