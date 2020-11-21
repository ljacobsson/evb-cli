const patternBuilder = require("../shared/schema-browser");
const inputUtil = require("../shared/input-util");

async function browseEvents(format, schemas, eventbridge) {
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

async function getTargets(schemas) {
  const { schema, sourceName } = await patternBuilder.getSchema(schemas);
  const AWS = require("aws-sdk");
  const evb = new AWS.EventBridge();
  const eventBusName = await inputUtil.getEventBusName(evb);
  const targets = [];
  const resp = await evb
    .listRules({ EventBusName: eventBusName, Limit: 100 })
    .promise();
  for (const rule of resp.Rules) {
    if (!rule.EventPattern) {
      continue;
    }
    const pattern = JSON.parse(rule.EventPattern);
    if (
      pattern.source == sourceName &&
      pattern["detail-type"] ==
        schema.components.schemas.AWSEvent["x-amazon-events-detail-type"]
    ) {
      const targetResponse = await evb
        .listTargetsByRule({
          Rule: rule.Name,
          EventBusName: eventBusName,
        })
        .promise();
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
  return { schema, targets };
}

module.exports = {
  browseEvents
}