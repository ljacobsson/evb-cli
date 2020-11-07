const AWS = require("aws-sdk");
const eventBridge = new AWS.EventBridge();
const sts = new AWS.STS();
const inputUtil = require("./input-util");
async function replay(eventbus, rulePrefix) {
  const caller = await sts.getCallerIdentity().promise();
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
  const rules = await eventBridge
    .listRules({ EventBusName: eventbus, NamePrefix: rulePrefix })
    .promise();
  const filteredRules = await inputUtil.multiSelectFrom(
    rules.Rules.filter((p) => !p.ManagedBy).map((p) => {
      return { name: p.Name, value: p };
    }),
    "Select rules to replay against"
  );
  const startDate = await inputUtil.getDate("Start date", false);
  const endDate = await inputUtil.getDate("End date", false);
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
};
