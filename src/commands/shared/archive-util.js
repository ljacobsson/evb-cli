const AWS = require("aws-sdk");
const inputUtil = require("./input-util");
const arnListener = require("../local/listeners/arnListener");
const fs = require("fs");
const tempDir = require("temp-dir");
const path = require("path");
const { split } = require("temp-dir");

let eventBridge, sts;

async function selectArchive(eventbus) {
  sts = sts || new AWS.STS();
  eventBridge = eventBridge || new AWS.EventBridge();
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
    await setupReplay(cmd, ruleConfig, stepFunctions);
  }
  if (ruleConfig) {
    const resp = await eventBridge.startReplay(ruleConfig).promise();
    console.log(
      `Replay started. Follow the progress here: https://${AWS.config.region}.console.aws.amazon.com/events/home?region=${AWS.config.region}#/replay/${ruleConfig.ReplayName}`
    );
  }
}

async function setupReplay(cmd, ruleConfig, stepFunctions) {
  const filterArns = [];
  cmd.rules = [];
  cmd.policies = [];
  cmd.permissions = [];
  await createAndExecute(cmd, ruleConfig, stepFunctions, filterArns);
}

async function createAndExecute(
  cmd,
  ruleConfig,
  stepFunctions,
  filterArns
) {
  for (const filterArn of ruleConfig.Destination.FilterArns) {
    let rule = await eventBridge
      .describeRule({
        Name: filterArn.split("/").slice(-1)[0],
        EventBusName: cmd.eventbus,
      })
      .promise();
    delete rule.CreatedBy;
    const name = `evb-cli-${rule.Name.substring(
      0,
      30
    )}-${new Date().getTime()}`;

    const pattern = JSON.parse(rule.EventPattern);
    pattern.source = cmd.sourceOverride || pattern.source; //OBS
    const sfRule = Object.assign({}, rule);
    sfRule.EventPattern = JSON.stringify(pattern);
    const dispatchSource = cmd.dispatchSourceOverride || pattern.source; //OBS

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
      }, "DispatchSource": "${
        cmd.dispatchSourceOverride
      }", "EventBusName": "${cmd.eventbus}", "ReplayName": "${
        cmd.replayName
      }"}`;
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
      cmd.rules.push(sfRule.Name);

      await stepFunctions
        .startExecution({
          stateMachineArn: sfTarget.Arn,
          input: JSON.stringify({
            EventBusName: cmd.eventbus,
            Action: "cleanup",
            OriginalEvent: {
              time: ruleConfig.EventEndTime,
            },
            Rules: cmd.rules,
            Policies: cmd.policies,
            Permissions: cmd.permissions,
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

module.exports = {
  replay,
  getReplayConfig,
  selectArchive,
  getDates,
  createAndExecute,
};
