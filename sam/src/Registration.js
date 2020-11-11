const AWS = require("aws-sdk");
const localRuleCreator = require("./builders/localRuleCreator");
const stackRuleCreator = require("./builders/stackRuleCreator");
const ruleArnCreator = require("./builders/ruleArnCreator");

const apigateway = new AWS.ApiGatewayManagementApi({
  endpoint: `https://${process.env.ApiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/Prod/`,
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

async function handler(event, context) {
  console.log(event);
  const body = JSON.parse(event.body);
  const token = body.token;
  const localRule = body.localRule;
  const ruleArn = body.ruleArn;
  console.log("Rulearn", ruleArn);
  let ruleNames;
  if (localRule) {
    ruleNames = await localRuleCreator.create(event);
  } else if (ruleArn) {
    ruleNames = await ruleArnCreator.create(event);
  } else {
    ruleNames = await stackRuleCreator.create(event);
  }
  if (ruleNames.error) {
    await apigateway
      .postToConnection({
        ConnectionId: event.requestContext.connectionId,
        Data: ruleNames.error.toString(),
      })
      .promise();
    return { statusCode: 500 };
  }
  await dynamoDb
    .put({
      Item: {
        id: event.requestContext.connectionId,
        rules: ruleNames,
        token: token,
      },
      TableName: process.env.ConnectionsTable,
    })
    .promise();

  await apigateway
    .postToConnection({
      ConnectionId: event.requestContext.connectionId,
      Data: JSON.stringify({
        Status: "Connected!",
        Rules: ruleNames,
        EvbLocalRegistration: true,
      }),
    })
    .promise();

  return { statusCode: 200 };
}

exports.handler = handler;
