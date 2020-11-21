const AWS = require("aws-sdk");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 10 });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const apigateway = new AWS.ApiGatewayManagementApi({
  endpoint: `https://${process.env.ApiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/Prod/`,
});

async function receiver(event, context) {
  const cacheKey = `connections_ ${event.Token}`;
  let connections = cache.get(cacheKey);

  if (!connections) {
    connections = (
      await dynamodb
        .query({
          TableName: process.env.ConnectionsTable,
          IndexName: "TokenGSI",
          KeyConditionExpression: "#token = :token",
          ExpressionAttributeNames: {
            "#token": "token",
          },
          ExpressionAttributeValues: {
            ":token": event.Token,
          },
        })
        .promise()
    ).Items;
    cache.set(cacheKey, connections);
  }
  console.log(connections);
  const tasks = [];
  for (const connection of connections) {
    try {
      tasks.push(
        apigateway
          .postToConnection({
            ConnectionId: connection.id,
            Data: JSON.stringify(event),
          })
          .promise()
      );
    } catch (ex) {
      console.log(ex);
    }
  }
  await Promise.all(tasks.map((p) => p.catch((e) => e)));

  return "Success";
}

module.exports = {
  receiver,
};
