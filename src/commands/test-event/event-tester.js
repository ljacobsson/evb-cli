const AWS = require("aws-sdk");
const fs = require("fs");
const eventBridgeUtil = require("../shared/eventbridge-util");

async function testEvent(eventFile, namePrefix, eventbus, showAll) {
  const eventBridge = new AWS.EventBridge();
  if (!fs.existsSync(eventFile)) {
    console.log(`Could not find ${eventFile}`);
    return;
  }
  const event = fs.readFileSync(eventFile).toString();
  for await (const ruleBatch of eventBridgeUtil.listRules(eventBridge, {
    EventBusName: eventbus,
    NamePrefix: namePrefix,
  }))
    for (const rule of ruleBatch.filter((p) => p.EventPattern)) {
      const match = await eventBridge
        .testEventPattern({ Event: event, EventPattern: rule.EventPattern })
        .promise();
      if (match.Result || showAll) {
        console.log(`${rule.Name}: [${match.Result ? "✓" : "x"}]`);
      }
    }
}

async function* ListRules(evb, params) {
  let token;
  do {
    const response = await evb
      .listRules({
        ...params,
        NextToken: token,
      })
      .promise();

    yield response.Rules;

    ({ NextToken: token } = response);
  } while (token);
}

module.exports = {
  testEvent,
};
