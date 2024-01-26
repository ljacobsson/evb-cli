const patternBuilder = require("../shared/schema-browser");
const inputUtil = require("../shared/input-util");
const eventBridgeUtil = require("../shared/eventbridge-util");
const { SchemasClient } = require("@aws-sdk/client-schemas");
const { EventBridgeClient, ListTargetsByRuleCommand } = require("@aws-sdk/client-eventbridge");
const { fromSSO } = require('@aws-sdk/credential-provider-sso');

async function browseEvents(cmd) {
  const schemas = new SchemasClient();
  while (true) {
    const { targets } = await getTargets(schemas);
    if (targets.length) {
      while (true) {
        console.log("CTRL+C to exit");
        const target = await inputUtil.selectFrom(
          targets,
          "Select target for more info"
        );

        if (target === inputUtil.BACK) {
          break;
        }

        let details = [{ name: "EventPattern", value: target.pattern }];
        for (const key of Object.keys(target.target)) {
          details.push({ name: key, value: target.target[key] });
        }
        details.push(inputUtil.CONSUME_LOCALLY);
        const detail = await inputUtil.selectFrom(
          details,
          "Select property for more info"
        );
        if (detail === inputUtil.BACK) {
          continue;
        }

        console.log("\n" + JSON.stringify(detail, null, 2) + "\n");
      }
    } else {
      console.log("No subscribers found");
    }
  }
}

async function getTargets() {
  const { schema, sourceName } = await patternBuilder.getSchema();
  const evb = new EventBridgeClient();
  const eventBusName = await inputUtil.getEventBusName();
  const targets = [];
  for await (const ruleBatch of eventBridgeUtil.listRules({
    EventBusName: eventBusName,
    Limit: 100,
  })) {
    for (const rule of ruleBatch) {
      if (!rule.EventPattern) {
        continue;
      }

      const pattern = JSON.parse(rule.EventPattern);
      if (
        pattern.source == sourceName &&
        pattern["detail-type"] ==
        schema.components.schemas.AWSEvent["x-amazon-events-detail-type"]
      ) {
        const targetResponse = await evb.send(new ListTargetsByRuleCommand({ Rule: rule.Name, EventBusName: eventBusName }));
        for (const target of targetResponse.Targets) {
          const arnSplit = target.Arn.split(":");
          const service = arnSplit[2];
          const name = arnSplit[arnSplit.length - 1];
          targets.push({
            name: `${service}: ${name}`,
            value: { pattern, target },
          });
        }
      }
    }
  }
  return { schema, targets };
}

module.exports = {
  browseEvents,
};
