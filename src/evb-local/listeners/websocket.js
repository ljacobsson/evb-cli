const WebSocket = require("ws");
const AWS = require("aws-sdk");

let ws, output;
function connect(url, token, stackName, compact, sam, rule, ruleArn, target, output) {
  output = output || console;
  const lambda = new AWS.Lambda({
    endpoint: "http://127.0.0.1:3001/",
    sslEnabled: false,
  });
  ws = new WebSocket(url);

  ws.on("open", function open() {
    const payload = JSON.stringify({
      action: "register",
      token: token,
      stack: stackName,
      localRule: rule,
      ruleArn: ruleArn,
      target: target,
    });
    ws.send(payload, (err) => {
      if (err) {
        output.log(err);
      }
    });
  });

  ws.on("message", async function incoming(data) {
    try {
      const obj = JSON.parse(data);
      delete obj.Token;

      let presentationObject = obj;
      if (rule) {
        presentationObject = obj.Body;
      }
      if (compact) {
        output.log(JSON.stringify(presentationObject));
      } else {
        output.log(JSON.stringify(presentationObject, null, 2));
      }
      if (sam) {
        try {
          await lambda
            .invoke({
              FunctionName: obj.Target,
              Payload: JSON.stringify(obj.Body),
            })
            .promise();
        } catch (err) {
          output.log(err);
        }
      }
    } catch {
      output.log(data);
    }
  });

  return ws;
}

async function apiId(cloudFormationClient) {
  const cloudFormation = cloudFormationClient || new AWS.CloudFormation();
  try {
    const evbLocalStack = await cloudFormation
      .listStackResources({ StackName: "serverlessrepo-evb-local" })
      .promise();
    const apiGatewayId = evbLocalStack.StackResourceSummaries.filter(
      (p) => p.LogicalResourceId === "WebSocket"
    )[0].PhysicalResourceId;
    return apiGatewayId;
  } catch(err){
    output = output || console;
    output.log(err.message);
    output.log("To use interactive features over websockets, please make sure the evb-local backend has been deployed in your account.");
    output.log("Visit https://serverlessrepo.aws.amazon.com/applications/eu-west-1/751354400372/evb-local and follow the instructions")    
  }
}

async function apiUrl() {
  return `wss://${await apiId()}.execute-api.${
    process.env.AWS_REGION
  }.amazonaws.com/Prod`
}

function disconnect() {
  if (ws)
    ws.close();
}

module.exports = {
  connect,
  disconnect,
  apiId,
  apiUrl,
};
