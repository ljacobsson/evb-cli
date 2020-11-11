const AWS = require("aws-sdk");
const inputUtil = require("./input-util");
const arnListener = require("./evb-local/listeners/arnListener");
const fs = require("fs");
const tempDir = require("temp-dir");
const path = require("path");

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

async function replay(eventbus, rulePrefix) {
  eventBridge = eventBridge || new AWS.EventBridge();
  await eventBridge
    .startReplay(await getReplayConfig(eventbus, rulePrefix, true))
    .promise();
  console.log("Replay started");
}

async function getReplayConfig(eventbus, rulePrefix, showRuleSelector) {
  eventBridge = eventBridge || new AWS.EventBridge();
  sts = sts || new AWS.STS();

  const archive = await selectArchive(eventbus);
  let filteredRules = [];
  if (showRuleSelector) {
    filteredRules = await selectRules(eventbus, rulePrefix);
  }
  const { startDate, endDate } = await getDates();
  return {
    Destination: {
      Arn: archive.EventSourceArn,
      FilterArns: filteredRules.map((p) => p.Arn),
    },
    EventSourceArn: `arn:aws:events:${AWS.config.region}:${caller.Account}:archive/${archive.ArchiveName}`,
    ReplayName: `evb-cli-replay-${new Date().getTime()}`,
    EventStartTime: new Date(startDate),
    EventEndTime: new Date(endDate),
  }
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
  const filteredRules = await inputUtil.multiSelectFrom(
    rules.Rules.filter((p) => !p.ManagedBy).map((p) => {
      return { name: p.Name, value: p };
    }),
    "Select rules to replay against"
  );
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
