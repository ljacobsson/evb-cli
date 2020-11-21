const AWS = require("aws-sdk");
const inputUtil = require("./input-util");
const arnListener = require("../local/listeners/arnListener");
const fs = require("fs");
const tempDir = require("temp-dir");
const path = require("path");
const { split } = require("temp-dir");

let eventBridge, sts;

async function selectArchive(eventbus) {
  caller = await sts.getCallerIdentity().promise();
  const busArn = `arn:aws:events:${AWS.config.region}:${caller.Account}:event-bus/${eventbus}`;
  const archives = await eventBridge
    .listArchives({
      EventSourceArn: busArn,
    })
    .promise();
  if (!archives.Archives.length) {
    console.log(`No archives found for eventbus ${eventbus}`);
    return;
  }
  const archive = await inputUtil.selectFrom(
    archives.Archives.map((p) => {
      return { name: p.ArchiveName, value: p };
    }),
    "Select archive",
    true
  );
  return archive;
}

async function replay(cmd) {
  eventBridge = new AWS.EventBridge();
  const stepFunctions = new AWS.StepFunctions();
  const ruleConfig = await getReplayConfig(cmd, true);
  if (cmd.replaySpeed > 0) {
    await setupReplay(
      ruleConfig,
      cmd.eventbus,
      cmd.replaySpeed,
      stepFunctions,
      cmd.replayName
    );
  }
  if (ruleConfig) {
    const resp = await eventBridge.startReplay(ruleConfig).promise();
    console.log(
      `Replay started. Follow the progress here: https://${AWS.config.region}.console.aws.amazon.com/events/home?region=${AWS.config.region}#/replay/${ruleConfig.ReplayName}`
    );
  }
}

async function setupReplay(
  ruleConfig,
  eventbus,
  replaySpeed,
  stepFunctions,
  replayName
) {
  const filterArns = [];
  for (const filterArn of ruleConfig.Destination.FilterArns) {
    let rule = await eventBridge
      .describeRule({
        Name: filterArn.split("/").slice(-1)[0],
        EventBusName: eventbus,
      })
      .promise();
    delete rule.CreatedBy;
    const sfRule = Object.assign({}, rule);
    const dispatchRule = Object.assign({}, rule);
    const pattern = JSON.parse(sfRule.EventPattern);
    sfRule.EventPattern = JSON.stringify(pattern);
    const dispatchSource = `${replayName}-${
      pattern.source
    }-${new Date().getTime()}`;
    pattern.source = [dispatchSource];
    dispatchRule.EventPattern = JSON.stringify(pattern);

    const targets = await eventBridge
      .listTargetsByRule({
        EventBusName: eventbus,
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
      sfTarget.InputTransformer.InputTemplate = `{\"OriginalEvent\": <OriginalEvent>, "StartTime": "${ruleConfig.EventStartTime}", "TargetArn": "${sfTarget.Arn}", "Action": "dispatch", "ReplaySpeed": ${replaySpeed}, "DispatchSource": "${dispatchSource}"}`;
      sfTarget.Arn = `arn:aws:states:${AWS.config.region}:${accountId}:stateMachine:evb-cli-paced-replays`;
      const name = `evb-cli-${sfRule.Name.substring(
        0,
        30
      )}-${new Date().getTime()}`;
      sfRule.Name = `${name}-sf`;
      dispatchRule.Name = `${name}-dispatch`;
      delete sfRule.Arn;
      delete dispatchRule.Arn;
      dispatchRule.EventBusName = "evb-cli-replaybus";
      sfRule.RoleArn = `arn:aws:iam::${accountId}:role/evb-cli-eventbridge-to-stepfunctions`;
      const evbSFRuleResponse = await eventBridge.putRule(sfRule).promise();
      const dispatchRuleResponse = await eventBridge
        .putRule(dispatchRule)
        .promise();

      sfTarget.RoleArn = `arn:aws:iam::${accountId}:role/evb-cli-eventbridge-to-stepfunctions`;

      await eventBridge
        .putTargets({
          Targets: [sfTarget],
          Rule: evbSFRuleResponse.RuleArn.split("/").slice(-1)[0],
          EventBusName: eventbus,
        })
        .promise();
      await eventBridge
        .putTargets({
          Targets: [target],
          Rule: dispatchRuleResponse.RuleArn.split("/").slice(-1)[0],
          EventBusName: dispatchRule.EventBusName,
        })
        .promise();
      await stepFunctions
        .startExecution({
          stateMachineArn: sfTarget.Arn,
          input: JSON.stringify({
            EventBusName: eventbus,
            Action: "cleanup",
            OriginalEvent: {
              time: ruleConfig.EventEndTime,
            },
            Rules: [sfRule.Name, dispatchRule.Name],
            StartTime: ruleConfig.EventStartTime,
            ReplaySpeed: replaySpeed,
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

  const archive = await selectArchive(cmd.eventbus);
  if (!archive) {
    return null;
  }
  let filteredRules = [];
  if (showRuleSelector) {
    filteredRules = await selectRules(cmd.eventbus, cmd.rulePrefix);
  }
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
