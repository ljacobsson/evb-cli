const AWS = require("aws-sdk");
const inputUtil = require("./input-util");
const arnListener = require("./evb-local/listeners/arnListener");
const fs = require("fs");
const tempDir = require("temp-dir");
const path = require("path");

let eventBridge, sts;
async function insights(eventbus, rulePrefix) {
  eventBridge = eventBridge || new AWS.EventBridge()
  sts = sts || new AWS.STS();
  const archive = await selectArchive(eventbus);
  const rule = await selectRule(eventbus, rulePrefix);
  const { startDate, endDate } = await getDates();
  const replayName = `evb-cli_replay_${new Date().getTime()}`;
  const filename = path.join(tempDir, `${replayName}.txt`);
  let count = 0,
    lastCount;
  await arnListener.init(
    rule.Arn,
    null,
    null,
    null,
    replayName,
    async (payload) => {
      if (payload.EvbLocalRegistration) {
        await init(payload, eventbus, archive, replayName, startDate, endDate);
        return;
      }
      fs.appendFileSync(filename, JSON.stringify(payload) + "\n");
      if (count === 0) {
        
        const interval = setInterval(() => {
          console.log(`Loaded ${count} events`);
          if (count === lastCount) {
            clearInterval(interval);
          }
          lastCount = count;
        }, 1000);
      }
      count++;
    }
  );
}

async function init(
  payload,
  eventbus,
  archive,
  replayName,
  startDate,
  endDate
) {
  console.log(
    "Initializing archive replay. This might take a few minutes depending on the amount of events."
  );
  for (const rule of payload.Rules) {
    const ruleResponse = await eventBridge
      .describeRule({ Name: rule, EventBusName: eventbus })
      .promise();
    await eventBridge
      .startReplay({
        Destination: {
          Arn: archive.EventSourceArn,
          FilterArns: [ruleResponse.Arn],
        },
        EventSourceArn: `arn:aws:events:${AWS.config.region}:${caller.Account}:archive/${archive.ArchiveName}`,
        ReplayName: replayName,
        EventStartTime: new Date(startDate),
        EventEndTime: new Date(endDate),
      })
      .promise();
  }
}

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
  sts = sts || new AWS.STS();

  const archive = await selectArchive(eventbus);
  const filteredRules = await selectRules(eventbus, rulePrefix);
  const { startDate, endDate } = await getDates();
  await eventBridge
    .startReplay({
      Destination: {
        Arn: archive.EventSourceArn,
        FilterArns: filteredRules.map((p) => p.Arn),
      },
      EventSourceArn: `arn:aws:events:${AWS.config.region}:${caller.Account}:archive/${archive.ArchiveName}`,
      ReplayName: `evb-cli_replay_${new Date().getTime()}`,
      EventStartTime: new Date(startDate),
      EventEndTime: new Date(endDate),
    })
    .promise();
  console.log("Replay started");
}

module.exports = {
  replay,
  insights,
};

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
