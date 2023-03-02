const AWS = require("aws-sdk");
const program = require("commander");
const filterPatterns = require("./find-usages");
const authHelper = require("../shared/auth-helper");

program
  .command("find-usages")
  .alias("f")
  .option("-b, --eventbus [eventbus]", "Name of the event bus to search.", "default")
  .option("-f, --filters [filters]", "Comma separated list of '$.json.path.to.property=regex-pattern' to filter the event patterns with")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option("--region [region]", "The AWS region to use. Falls back on AWS_REGION environment variable if not specified")
  .description(`Searches all rules on a bus for matching event patterns.\n\nI.e to find all rules that match on an s3:PutObject event from CloudTrail, use:\nevb find-usages -f $.source=aws.s3,$.detail-type=.+CloudTrail,$.detail.eventName=PutObject`)
  .action(async (cmd) => {
    authHelper.initAuth(cmd);
    try {
      await filterPatterns.find(cmd);
    } catch (err) {
      console.error(err.message);
    }

  });
