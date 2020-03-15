#!/usr/bin/env node
const patternBuilder = require("./pattern-builder");
const codeBinding = require("./code-binding");
const AWS = require("aws-sdk");
const program = require("commander");
const ssoAuth = require("@mhlabs/aws-sso-client-auth");
const storage = require("node-persist");
const os = require("os");

program.version("1.0.0", "-v, --vers", "output the current version");
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
    await storage.init({
      dir: `${os.homedir()}/.evb-cli`
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
    const schemaApi = new AWS.Schemas();
    await patternBuilder.buildPattern(cmd.format, schemaApi);
  });
// Commenting this out since there seems to be an SDK bug with getting code bindings
//
// program
// .command("code-bindings")
// .alias("c")
// .description("Get code binding for a schema")
// .action(async () => {
//   await codeBinding.browse();
// });

program
  .command("configure-sso")
  .option("-a, --account-id <accountId>", "Account ID")
  .option("-u, --start-url <startUrl>", "AWS SSO start URL")
  .option("--region <region>", "AWS region")
  .option("--role <role>", "AWS region")
  .description("Configure authentication with AWS Single Sign-On")
  .action(async cmd => {
    await storage.init({
      dir: `${os.homedir()}/.evb-cli`,
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
