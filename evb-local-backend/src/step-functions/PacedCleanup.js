const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge();
const lambda = new AWS.Lambda();
const iam = new AWS.IAM();
exports.handler = async function (event, context) {
  for (const rule of event.Rules) {
    const bus = event.EventBusName;
    const targets = await eventbridge
      .listTargetsByRule({
        EventBusName: bus,
        Rule: rule,
      })
      .promise();
    await eventbridge
      .removeTargets({
        Ids: targets.Targets.map((p) => p.Id),
        Rule: rule,
        EventBusName: bus,
      })
      .promise();
    await eventbridge.deleteRule({ EventBusName: bus, Name: rule }).promise();
  }
  for (const item of event.Policies) {
    await iam
      .deleteRolePolicy({
        RoleName: item.roleName,
        PolicyName: item.policyName,
      })
      .promise();
  }
  for (const item of event.Permissions) {
    await lambda
      .removePermission({
        FunctionName: item.functionName,
        StatementId: item.statementId,
      })
      .promise();
  }
};
