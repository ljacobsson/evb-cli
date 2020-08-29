const AWS = require("aws-sdk");

const dynamoDb = new AWS.DynamoDB.DocumentClient();
async function handler(event, context, callback) {
  await dynamoDb
    .put({
      Item: { id: event.requestContext.connectionId },
      TableName: process.env.ConnectionsTable,
    })
    .promise();

  callback(null, { statusCode: 200, body: "Connected!" });
}

exports.handler = handler;
