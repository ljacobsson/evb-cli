const program = require("commander");
const authHelper = require("../shared/auth-helper");
const codeBinding = require("./code-binding");

program
  .command("code-binding")
  .alias("cb")
  .option("-t, --template [template]", "Path to template file")
  .option("-n, --type-name [typeName]", "Type name", "MyType")
  .option("-p, --profile [profile]", "AWS profile to use")
  .option(
    "-r, --region [region]",
    "The AWS region to use. Falls back on AWS_REGION environment variable if not specified"
  )
  .option(
    "-o, --output-file [outputFile]",
    "Output file name. Writes to std out if skipped"
  )
  .option("-l, --language [language]", "Output language")
  .description("Generates code bindings from an InputTransformer template")
  .action(async (cmd) => {
    await authHelper.initAuth(cmd);

    if (!cmd.language) {
      cmd.language = await codeBinding.getLanguageInput();
    }
 
    if (cmd.template) {
      await codeBinding.loadFromTemplate(cmd);
    } else {
      await codeBinding.loadFromRegistry(cmd);
    }
  });
