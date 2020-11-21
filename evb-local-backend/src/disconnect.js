const AWS = require("aws-sdk");
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const eventBridge = new AWS.EventBridge();
async function handler(event, context) {
  const connection = await dynamoDb
    .get({
      Key: { id: event.requestContext.connectionId },
      TableName: process.env.ConnectionsTable,
    })
    .promise();
  await dynamoDb
    .delete({
      Key: { id: event.requestContext.connectionId },
      TableName: process.env.ConnectionsTable,
    })
    .promise();
  console.log(JSON.stringify(connection));
  for (const rule of connection.Item.rules) {
    const busName = rule.split("-")[2];
    const targets = await eventBridge
      .listTargetsByRule({ EventBusName: busName, Rule: rule })
      .promise();
    await eventBridge
      .removeTargets({
        EventBusName: busName,
        Rule: rule,
        Ids: targets.Targets.map((p) => p.Id),
      })
      .promise();
    await eventBridge
      .deleteRule({ EventBusName: busName, Name: rule })
      .promise();
  }
  return { statusCode: 200, body: "Disconnected!" };
}

exports.handler = handler;
