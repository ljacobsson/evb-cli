const program = require("commander");
const authHelper = require("../shared/auth-helper");
const archiveUtil = require("../shared/archive-util");

program
  .command("replay")
  .alias("r")
  .option(
    "-b, --eventbus [eventbus]",
    "The eventbus the archive is stored against",
    "default"
  )
  .option("-r, --rule-prefix [rulePrefix]", "Rule name prefix")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option(
    "-s, --replay-speed [speed]",
    "The speed of the replay in % where 0 == all at once and 100 == real time speed"
  )
  .option(
    "-n, --replay-name [name]",
    "The replay name",
    `evb-cli-replay-${new Date().getTime()}`
  )
  .option(
    "--region [region]",
    "The AWS region to use. Falls back on AWS_REGION environment variable if not specified"
  )
  .description("Starts a replay of events against a specific destination")
  .action(async (cmd) => {
    authHelper.initAuth(cmd);
    await archiveUtil.replay(cmd);
  });
