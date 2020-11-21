const templateParser = require("../shared/template-parser");
const samExtractor = require("./sam-extractor");
const program = require("commander");
program
  .command("extract-sam-event")
  .alias("e")
  .option("-t, --template [template]", "Path to template file", "template.yaml")
  .description(
    "Extracts an EventBusRule event from an AWS::Serverless::Function resource to an AWS::Events::Rule for more advanced use cases"
  )
  .action(async (cmd) => {
    const template = templateParser.load(cmd.template);
    await samExtractor.extractSamDefinition(template);
  });
