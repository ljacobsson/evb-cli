const { LambdaClient, GetFunctionCommand, ListFunctionEventInvokeConfigsCommand, ListFunctionsCommand } = require("@aws-sdk/client-lambda");
const { EventBridgeClient, PutRuleCommand, PutTargetsCommand } = require("@aws-sdk/client-eventbridge");
const { IAMClient, PutRolePolicyCommand } = require("@aws-sdk/client-iam");
const inputUtil = require("../shared/input-util");
const archiveUtil = require("./replay-util");
const { Spinner } = require("cli-spinner");
const { AddPermissionCommand } = require("@aws-sdk/client-sns");
const spinner = new Spinner();

async function replayLambda(cmd) {
  const lambda = new LambdaClient();
  const iam = new IAMClient();
  const eventBridge = new EventBridgeClient();

  const destinations = [];
  let explicitFunc;
  if (cmd.functionName) {
    const lambdaResponse = await lambda.send(new GetFunctionCommand({ FunctionName: cmd.functionName }));
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
        const config = await lambda.send(new ListFunctionEventInvokeConfigsCommand({ FunctionName: func.FunctionName }));
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
  const rule = await eventBridge.send( new PutRuleCommand({
      Name: cmd.replayName,
      EventBusName: busName,
      EventPattern: JSON.stringify({
        "detail-type": ["Lambda Function Invocation Result - Failure"],
        resources: [invokeConfig.FunctionArn],
        source: [cmd.replayName],
      }),
    }));

  await eventBridge.send( new PutTargetsCommand({
      Targets: [
        {
          Arn: invokeConfig.FunctionArn.replace(":$LATEST", ""),
          Id: `evb-cli-${new Date().getTime()}`,
          InputPath: "$.detail.requestPayload",
        },
      ],
      Rule: rule.RuleArn.split("/").slice(-1)[0],
      EventBusName: busName,
    }));

  const functionResponse = await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));

  const policyName = `evb-cli-replaypolicy-${new Date().getTime()}`;
  const roleName = functionResponse.Configuration.Role.split("/").slice(-1)[0];
  const policyResponse = await iam.send(new PutRolePolicyCommand({
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
  }));

  const statementId = `evb-cli-sid-${new Date().getTime()}`;
  await lambda.send(new AddPermissionCommand({
    FunctionName: functionName,
    StatementId: statementId,
    Action: "lambda:InvokeFunction",
    Principal: "events.amazonaws.com",
    SourceArn: rule.RuleArn,
  }));

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
    const response = await lambda.send(new ListFunctionsCommand({
      ...params,
      Marker: token,
    }));

    yield response.Functions;

    ({ NextMarker: token } = response);
  } while (token);
}

module.exports = {
  replayLambda,
};
