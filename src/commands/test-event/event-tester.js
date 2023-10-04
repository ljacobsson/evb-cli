const  { EventBridgeClient, TestEventPatternCommand } = require("@aws-sdk/client-eventbridge");
const fs = require("fs");
const eventBridgeUtil = require("../shared/eventbridge-util");

async function testEvent(eventFile, namePrefix, eventbus, showAll) {
  const eventBridge = new EventBridgeClient();
  if (!fs.existsSync(eventFile)) {
    console.log(`Could not find ${eventFile}`);
    return;
  }
  const event = fs.readFileSync(eventFile).toString();
  for await (const ruleBatch of eventBridgeUtil.listRules({
    EventBusName: eventbus,
    NamePrefix: namePrefix,
  }))
    for (const rule of ruleBatch.filter((p) => p.EventPattern)) {
      const match = await eventBridge.send( new TestEventPatternCommand({ Event: event, EventPattern: rule.EventPattern }));
      if (match.Result || showAll) {
        console.log(`${rule.Name}: [${match.Result ? "✓" : "x"}]`);
      }
    }
}


module.exports = {
  testEvent,
};
