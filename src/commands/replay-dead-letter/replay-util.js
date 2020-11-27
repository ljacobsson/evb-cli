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
    await eventBridge.startReplay(ruleConfig).promise();
    console.log(
      `Replay started. Follow the progress here: https://${AWS.config.region}.console.aws.amazon.com/events/home?region=${AWS.config.region}#/replay/${ruleConfig.ReplayName}`
    );
  }
}

async function setupPacedReplay(cmd, ruleConfig, stepFunctions) {
  const busArn = `arn:aws:events:${AWS.config.region}:${caller.Account}:event-bus/${cmd.eventbus}`;
  ruleConfig.Destination.Arn = busArn;
  const filterArns = [];
  cmd.rules = [];

  const dispatchRule = await eventBridge
    .describeRule({
      Name: cmd.ruleArn.split("/").slice(-1)[0],
      EventBusName: cmd.eventbus,
    })
    .promise();
  cmd.rules.push(dispatchRule.Name);
  cmd.sourceOverride = ["lambda"];
  cmd.dispatchSourceOverride = cmd.replayName;
  await archiveUtil.createAndExecute(
    cmd,
    ruleConfig,    
    stepFunctions,
    filterArns
  );
}

async function getReplayConfig(cmd, showRuleSelector) {
  eventBridge = eventBridge || new AWS.EventBridge();
  sts = sts || new AWS.STS();

  const archive = await archiveUtil.selectArchive(
    cmd.archiveBus || cmd.eventbus
  );
  if (!archive) {
    return null;
  }
  let filteredRules = [];
  filteredRules.push({ Arn: cmd.ruleArn });
  const { startDate, endDate } = await archiveUtil.getDates();
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

module.exports = {
  replay,
  getReplayConfig,
};
