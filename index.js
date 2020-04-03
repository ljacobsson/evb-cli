#!/usr/bin/env node
const patternBuilder = require("./pattern-builder");
const AWS = require("aws-sdk");
const program = require("commander");
const ssoAuth = require("@mhlabs/aws-sso-client-auth");
const storage = require("node-persist");
const os = require("os");

const EVB_CACHE_DIR = `${os.homedir()}/.evb-cli`;

program.version("1.0.11", "-v, --vers", "output the current version");
program
  .command("pattern")
  .alias("p")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option(
    "--sso",
    "Authenticate with AWS SSO. Set environment variable EVB_CLI_SSO=1 for default behaviour"
  )
  .description("Starts an EventBridge pattern builder")
  .action(async cmd => {
    await authenticate();
    const schemaApi = new AWS.Schemas();
    await patternBuilder.buildPattern(cmd.format, schemaApi);
  });

  program
  .command("input")
  .alias("i")
  .option("-f, --format <json|yaml>", "Select output format", "json")
  .option(
    "--sso",
    "Authenticate with AWS SSO. Set environment variable EVB_CLI_SSO=1 for default behaviour"
  )
  .description("Starts an EventBridge InputTransformer builder")
  .action(async cmd => {
    await authenticate();
    const schemaApi = new AWS.Schemas();
    await patternBuilder.buildInputTransformer(cmd.format, schemaApi);
  });
  
  program
  .command("browse")
  .alias("b")
  .description("Browses sources and detail types and shows their consumers")
  .action(async cmd => {
    await authenticate();
    const schemaApi = new AWS.Schemas();
    const evbApi = new AWS.EventBridge();
    await patternBuilder.browseEvents(cmd.format, schemaApi, evbApi);
  });
  
program
  .on("command:*", () => {
    const command = program.args[0];

    console.error(`Unknown command '${command}'`);
    process.exit(1);
  })
  .command("configure-sso")
  .option("-a, --account-id <accountId>", "Account ID")
  .option("-u, --start-url <startUrl>", "AWS SSO start URL")
  .option("--region <region>", "AWS region")
  .option("--role <role>", "Role to get credentials for")
  .description("Configure authentication with AWS Single Sign-On")
  .action(async cmd => {
    await storage.init({
      dir: EVB_CACHE_DIR,
      expiredInterval: 0
    });

    await storage.setItem("evb-cli-sso", {
      accountId: cmd.accountId,
      startUrl: cmd.startUrl,
      region: cmd.region,
      role: cmd.role
    });
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
async function authenticate() {
  await storage.init({
    dir: EVB_CACHE_DIR
  });
  const ssoConfig = await storage.getItem("evb-cli-sso");
  if (ssoConfig) {
    await ssoAuth.configure({
      clientName: "evb-cli",
      startUrl: ssoConfig.startUrl,
      accountId: ssoConfig.accountId,
      region: ssoConfig.region
    });
    AWS.config.update({
      credentials: await ssoAuth.authenticate(ssoConfig.role)
    });
  }
}

