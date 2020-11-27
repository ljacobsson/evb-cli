const program = require("commander");
const authHelper = require("../shared/auth-helper");
const replaylambda = require("./replay-lambda");

program
  .command("replay-dead-letter")
  .alias("rdl")
  .option("-n, --function-name [functionName]", "Function name")
  .option("-p, --function-name-prefix [functionNamePrefix]", "Function name prefix to speed up load")
  .option("--profile [profile]", "AWS profile to use")
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
    await replaylambda.replayLambda(cmd);
  });
