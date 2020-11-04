const AWS = require("aws-sdk");
const fs = require("fs");
async function testEvent(eventFile, namePrefix, eventbus, showAll) {
  const eventBridge = new AWS.EventBridge();
  if (!fs.existsSync(eventFile)) {
    console.log(`Could not find ${eventFile}`);
    return;
  }
  const event = fs.readFileSync(eventFile).toString();
  const rules = await eventBridge
    .listRules({ EventBusName: eventbus, NamePrefix: namePrefix })
    .promise();
  for (const rule of rules.Rules.filter((p) => p.EventPattern)) {
    const match = await eventBridge
      .testEventPattern({ Event: event, EventPattern: rule.EventPattern })
      .promise();
    if (match.Result || showAll) {
      console.log(`${rule.Name}: [${match.Result ? "✓" : "x"}]`);
    }
  }
}

module.exports = {
  testEvent,
};
