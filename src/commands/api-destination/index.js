const program = require("commander");
const templateParser = require("../shared/template-parser");
const apiDestination = require("./api-destination");
const authHelper = require("../shared/auth-helper");
const AWS = require("aws-sdk");
program
  .command("api-destination")
  .alias("api")
  .requiredOption("-t, --template [template]", "Path to template file", "template.yaml")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option(
    "--region [region]",
    "The AWS region to use. Falls back on AWS_REGION environment variable if not specified"
  )
  .requiredOption("-u --url [url]", "URL to OpenAPI specification of API")
  .description("Generates API Destination SAM template resources")
  .action(async (cmd) => {
    authHelper.initAuth(cmd);

    await apiDestination.create(cmd);

    //await templateParser.injectPattern(pattern);
  });
