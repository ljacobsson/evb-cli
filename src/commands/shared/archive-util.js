const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { EventBridgeClient, ListArchivesCommand, DescribeRuleCommand, StartReplayCommand, ListTargetsByRuleCommand, PutRuleCommand, PutTargetsCommand,  } = require("@aws-sdk/client-eventbridge");
const { SFNClient } = require("@aws-sdk/client-sfn");
const inputUtil = require("./input-util");


async function selectArchive(eventbus) {
  const sts = new STSClient();
  const eventBridge = new EventBridgeClient();
  caller = await sts.send(new GetCallerIdentityCommand({}));
  const busArn = `arn:aws:events:${process.env.AWS_REGION}:${caller.Account}:event-bus/${eventbus}`;
  const archives = await eventBridge.send(new ListArchivesCommand({
    EventSourceArn: busArn,
  }));
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
  const eventBridge = new EventBridgeClient();
  const ruleConfig = await getReplayConfig(cmd, true);
  if (cmd.replaySpeed > 0) {
    await setupReplay(cmd, ruleConfig);
  }
  if (ruleConfig) {
    const resp = await eventBridge.send(new StartReplayCommand(ruleConfig));
    console.log(
      `Replay started. Follow the progress here: https://${process.env.AWS_REGION}.console.aws.amazon.com/events/home?region=${process.env.AWS_REGION}#/replay/${ruleConfig.ReplayName}`
    );
  }
}

async function setupReplay(cmd, ruleConfig) {
  const filterArns = [];
  cmd.rules = [];
  cmd.policies = [];
  cmd.permissions = [];
  await createAndExecute(cmd, ruleConfig, filterArns);
}

async function createAndExecute(
  cmd,
  ruleConfig,
  filterArns
) {
  const stepFunctions = new SFNClient();
  const eventBridge = new EventBridgeClient();

  for (const filterArn of ruleConfig.Destination.FilterArns) {
    let rule = await eventBridge.send(new DescribeRuleCommand({
      Name: filterArn.split("/").slice(-1)[0],
      EventBusName: cmd.eventbus,
    }));
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

    const targets = await eventBridge.send(new ListTargetsByRuleCommand({

      EventBusName: cmd.eventbus,
      Rule: sfRule.Name.split("/").slice(-1)[0],
    }));

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
      sfTarget.InputTransformer.InputTemplate = `{\"OriginalEvent\": <OriginalEvent>, "StartTime": "${ruleConfig.EventStartTime
        }", "TargetArn": "${sfTarget.Arn
        }", "Action": "dispatch", "ReplaySpeed": ${cmd.replaySpeed || 0
        }, "DispatchSource": "${cmd.dispatchSourceOverride
        }", "EventBusName": "${cmd.eventbus}", "ReplayName": "${cmd.replayName
        }"}`;
      sfTarget.Arn = `arn:aws:states:${process.env.AWS_REGION}:${accountId}:stateMachine:evb-cli-paced-replays`;
      sfRule.Name = `${name}-sf`;
      delete sfRule.Arn;
      sfRule.RoleArn = `arn:aws:iam::${accountId}:role/evb-cli-eventbridge-to-stepfunctions-${process.env.AWS_REGION}`;
      const evbSFRuleResponse = await eventBridge.send(new PutRuleCommand(sfRule));

      sfTarget.RoleArn = `arn:aws:iam::${accountId}:role/evb-cli-eventbridge-to-stepfunctions-${process.env.AWS_REGION}`;

      await eventBridge.send(new PutTargetsCommand({
        Targets: [sfTarget],
        Rule: evbSFRuleResponse.RuleArn.split("/").slice(-1)[0],
        EventBusName: cmd.eventbus,
      }));
      cmd.rules.push(sfRule.Name);

      await stepFunctions.send(new StartExecutionCommand({
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
      }));

      filterArns.push(evbSFRuleResponse.RuleArn);
    }
  }

  ruleConfig.Destination.FilterArns = filterArns;
}

async function getReplayConfig(cmd, showRuleSelector) {  
  const sts = new STSClient();
  const caller = await sts.send(new GetCallerIdentityCommand({}));

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
    EventSourceArn: `arn:aws:events:${process.env.AWS_REGION}:${caller.Account}:archive/${archive.ArchiveName}`,
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
  const rules = [];
  let token;
  do {
    const ruleResponse = await eventBridge
      .listRules({ EventBusName: eventbus, NamePrefix: rulePrefix, NextToken: token })
      .promise();
    token = ruleResponse.NextToken;
    rules.push(...ruleResponse.Rules);
  } while (token)
  let filteredRules;

  do {
    filteredRules = await inputUtil.multiSelectFrom(
      rules.filter((p) => !p.ManagedBy).map((p) => {
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
