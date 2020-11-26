const AWS = require("aws-sdk");
const inputUtil = require("../shared/input-util");
const archiveUtil = require("../shared/archive-util");

let eventBridge, sts;

async function replay(cmd) {
  eventBridge = new AWS.EventBridge();
  const stepFunctions = new AWS.StepFunctions();
  const ruleConfig = await getReplayConfig(cmd);
  if (cmd.cleanUp || cmd.replaySpeed > 0) {
    await setupPacedReplay(cmd, ruleConfig, stepFunctions);
  }
  if (ruleConfig) {
    const resp = await eventBridge.startReplay(ruleConfig).promise();
    console.log(
      `Replay started. Follow the progress here: https://${AWS.config.region}.console.aws.amazon.com/events/home?region=${AWS.config.region}#/replay/${ruleConfig.ReplayName}`
    );
  }
}

async function setupPacedReplay(cmd, ruleConfig, stepFunctions) {
  const busArn = `arn:aws:events:${AWS.config.region}:${caller.Account}:event-bus/${cmd.eventbus}`;
  ruleConfig.Destination.Arn = busArn;
  const filterArns = [];
  const dispatchRule = await eventBridge
  .describeRule({
    Name: cmd.ruleArn.split("/").slice(-1)[0],
    EventBusName: cmd.eventbus,
  })
  .promise();

  for (const filterArn of ruleConfig.Destination.FilterArns) {
    let rule = await eventBridge
    .describeRule({
      Name: filterArn.split("/").slice(-1)[0],
      EventBusName: cmd.eventbus,
    })
    .promise();
    delete rule.CreatedBy;
    const sfRule = Object.assign({}, rule);
    const name = `evb-cli-${sfRule.Name.substring(
      0,
      30
    )}-${new Date().getTime()}`;

    const pattern = JSON.parse(sfRule.EventPattern);
    pattern.source = ["lambda"];
    sfRule.EventPattern = JSON.stringify(pattern);
    const dispatchSource = cmd.replayName;

    const targets = await eventBridge
      .listTargetsByRule({
        EventBusName: cmd.eventbus,
        Rule: sfRule.Name.split("/").slice(-1)[0],
      })
      .promise();
    for (const target of targets.Targets) {
      const sfTarget = Object.assign({}, target);
      delete sfTarget.Input;
      delete sfTarget.InputPath;
      sfTarget.InputTransformer = {
        InputPathsMap: {
          OriginalEvent: "$",
        },
      };
      const accountId = ruleConfig.EventSourceArn.split(":")[4];
      sfTarget.InputTransformer.InputTemplate = `{\"OriginalEvent\": <OriginalEvent>, "StartTime": "${
        ruleConfig.EventStartTime
      }", "TargetArn": "${
        sfTarget.Arn
      }", "Action": "dispatch", "ReplaySpeed": ${
        cmd.replaySpeed || 0
      }, "DispatchSource": "${dispatchSource}", "EventBusName": "${
        cmd.dispatchEventBus || cmd.eventbus
      }", "ReplayName": "${cmd.replayName}"}`;
      sfTarget.Arn = `arn:aws:states:${AWS.config.region}:${accountId}:stateMachine:evb-cli-paced-replays`;
      sfRule.Name = `${name}-sf`;
      delete sfRule.Arn;
      sfRule.RoleArn = `arn:aws:iam::${accountId}:role/evb-cli-eventbridge-to-stepfunctions`;
      const evbSFRuleResponse = await eventBridge.putRule(sfRule).promise();

      sfTarget.RoleArn = `arn:aws:iam::${accountId}:role/evb-cli-eventbridge-to-stepfunctions`;

      await eventBridge
        .putTargets({
          Targets: [sfTarget],
          Rule: evbSFRuleResponse.RuleArn.split("/").slice(-1)[0],
          EventBusName: cmd.eventbus,
        })
        .promise();

      await stepFunctions
        .startExecution({
          stateMachineArn: sfTarget.Arn,
          input: JSON.stringify({
            EventBusName: cmd.eventbus,
            Action: "cleanup",
            OriginalEvent: {
              time: ruleConfig.EventEndTime,
            },
            Rules: [sfRule.Name, dispatchRule.Name],

            StartTime: ruleConfig.EventStartTime,
            ReplaySpeed: cmd.replaySpeed || 0,
            DispatchSource: dispatchSource,
          }),
        })
        .promise();
      filterArns.push(evbSFRuleResponse.RuleArn);
    }
  }

  ruleConfig.Destination.FilterArns = filterArns;
}

async function getReplayConfig(cmd, showRuleSelector) {
  eventBridge = eventBridge || new AWS.EventBridge();
  sts = sts || new AWS.STS();

  const archive = await archiveUtil.selectArchive(cmd.archiveBus || cmd.eventbus);
  if (!archive) {
    return null;
  }
  let filteredRules = [];
  filteredRules.push({ Arn: cmd.ruleArn });
  const { startDate, endDate } = await getDates();
  return {
    Destination: {
      Arn: archive.EventSourceArn,
      FilterArns: filteredRules.map((p) => p.Arn),
    },
    EventSourceArn: `arn:aws:events:${AWS.config.region}:${caller.Account}:archive/${archive.ArchiveName}`,
    ReplayName: cmd.replayName || `evb-local-${new Date().getTime()}`,
    EventStartTime: new Date(startDate),
    EventEndTime: new Date(endDate),
  };
}

async function getDates() {
  const startDate = await inputUtil.getDate("Start date", false);
  const endDate = await inputUtil.getDate("End date", false);
  return { startDate, endDate };
}

async function selectRules(eventbus, rulePrefix) {
  const rules = await eventBridge
    .listRules({ EventBusName: eventbus, NamePrefix: rulePrefix })
    .promise();
  let filteredRules;

  do {
    filteredRules = await inputUtil.multiSelectFrom(
      rules.Rules.filter((p) => !p.ManagedBy).map((p) => {
        return { name: p.Name, value: p };
      }),
      "Select rules to replay against",
      true
    );
  } while (filteredRules && filteredRules.length === 0);
  return filteredRules;
}

async function selectRule(eventbus, rulePrefix) {
  const rules = await eventBridge
    .listRules({ EventBusName: eventbus, NamePrefix: rulePrefix })
    .promise();
  const filteredRules = await inputUtil.selectFrom(
    rules.Rules.filter((p) => !p.ManagedBy).map((p) => {
      return { name: p.Name, value: p };
    }),
    "Select rule to filter against"
  );
  return filteredRules;
}

module.exports = {
  replay,
  getReplayConfig,
};
