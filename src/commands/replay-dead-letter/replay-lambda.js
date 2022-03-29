const AWS = require("aws-sdk");
const inputUtil = require("../shared/input-util");
const archiveUtil = require("./replay-util");
const { Spinner } = require("cli-spinner");
const spinner = new Spinner();

async function replayLambda(cmd) {
  const lambda = new AWS.Lambda();
  const iam = new AWS.IAM();
  const eventBridge = new AWS.EventBridge();

  const destinations = [];
  let explicitFunc;
  if (cmd.functionName) {
    const lambdaResponse = await lambda
      .getFunction({ FunctionName: cmd.functionName })
      .promise();
    explicitFunc = [
      [{ FunctionName: lambdaResponse.Configuration.FunctionName }],
    ];
  }
  console.log("Loading functions...");
  spinner.setSpinnerString("⠁⠁⠉⠙⠚⠒⠂⠂⠒⠲⠴⠤⠄⠄⠤⠠⠠⠤⠦⠖⠒⠐⠐⠒⠓⠋⠉⠈⠈");
  spinner.start();

  for await (const funcBatch of explicitFunc || ListFunctions(lambda, {})) {
    const tasks = [];
    for (const func of funcBatch) {
      if (
        !cmd.functionNamePrefix ||
        func.FunctionName.startsWith(cmd.functionNamePrefix)
      ) {
        const config = await lambda
          .listFunctionEventInvokeConfigs({ FunctionName: func.FunctionName })
          .promise();
        if (
          config.FunctionEventInvokeConfigs &&
          config.FunctionEventInvokeConfigs.length &&
          config.FunctionEventInvokeConfigs[0].DestinationConfig &&
          config.FunctionEventInvokeConfigs[0].DestinationConfig.OnFailure &&
          config.FunctionEventInvokeConfigs[0].DestinationConfig.OnFailure.Destination &&
          config.FunctionEventInvokeConfigs[0].DestinationConfig.OnFailure.Destination.startsWith(
            "arn:aws:events:"
          )
        ) {
          destinations.push(config);
        }
      }
    }
  }
  spinner.stop();
  console.log("\nDone!");

  let functionConfig;

  if (destinations.length > 1) {
    functionConfig = await inputUtil.selectFrom(
      destinations.map((d) => {
        return {
          name: d.FunctionEventInvokeConfigs[0].FunctionArn.split(":").slice(
            -2
          )[0],
          value: d,
        };
      }),
      "Choose lambda function",
      true
    );
  } else if (destinations.length === 1) {
    functionConfig = destinations[0];
  } else {
    console.log("No EventBridge OnFailure destinations found");
    return;
  }

  const invokeConfig = functionConfig.FunctionEventInvokeConfigs[0];
  const functionName = invokeConfig.FunctionArn.split(":").slice(-2)[0];
  const busName = invokeConfig.DestinationConfig.OnFailure.Destination.split(
    "/"
  ).slice(-1)[0];
  const rule = await eventBridge
    .putRule({
      Name: cmd.replayName,
      EventBusName: busName,
      EventPattern: JSON.stringify({
        "detail-type": ["Lambda Function Invocation Result - Failure"],
        resources: [invokeConfig.FunctionArn],
        source: [cmd.replayName],
      }),
    })
    .promise();

  await eventBridge
    .putTargets({
      Targets: [
        {
          Arn: invokeConfig.FunctionArn.replace(":$LATEST", ""),
          Id: `evb-cli-${new Date().getTime()}`,
          InputPath: "$.detail.requestPayload",
        },
      ],
      Rule: rule.RuleArn.split("/").slice(-1)[0],
      EventBusName: busName,
    })
    .promise();

  const functionResponse = await lambda
    .getFunction({ FunctionName: functionName })
    .promise();

  const policyName = `evb-cli-replaypolicy-${new Date().getTime()}`;
  const roleName = functionResponse.Configuration.Role.split("/").slice(-1)[0];
  const policyResponse = await iam
    .putRolePolicy({
      RoleName: roleName,
      PolicyName: policyName,
      PolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Id: `evb-cli-generated`,
        Statement: [
          {
            Sid: "evbclisid",
            Effect: "Allow",
            Action: "lambda:InvokeFunction",
            Resource: functionResponse.Configuration.FunctionArn,
            Condition: {
              ArnLike: {
                "AWS:SourceArn": rule.RuleArn,
              },
            },
          },
        ],
      }),
    })
    .promise();
  const statementId = `evb-cli-sid-${new Date().getTime()}`;
  await lambda
    .addPermission({
      FunctionName: functionName,
      StatementId: statementId,
      Action: "lambda:InvokeFunction",
      Principal: "events.amazonaws.com",
      SourceArn: rule.RuleArn,
    })
    .promise();
  cmd.policies = [{ roleName, policyName }];
  cmd.permissions = [{ functionName, statementId }];
  await archiveUtil.replay(
    {
      ...cmd,
      eventbus: busName,
      cleanUp: true,
      ruleArn: rule.RuleArn,
      dispatchBus: busName,
    },
    false
  );
}

async function* ListFunctions(lambda, params) {
  let token;
  do {
    const response = await lambda
      .listFunctions({
        ...params,
        Marker: token,
      })
      .promise();

    yield response.Functions;

    ({ NextMarker: token } = response);
  } while (token);
}

module.exports = {
  replayLambda,
};
