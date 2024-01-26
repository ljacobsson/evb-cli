const program = require("commander");
const eventTester = require("./event-tester");
const authHelper = require("../shared/auth-helper");

program
  .command("test-event")
  .alias("t")
  .option(
    "-e, --event-input-file [event-file]",
    "Path to test event",
    "event.json"
  )
  .option(
    "-n, --name-prefix [name-prefix]",
    "Name prefix for rules to test against fewer rules"
  )
  .option(
    "-b, --eventbus [eventbus]",
    "The eventbus to test against",
    "default"
  )
  .option("-a, --all", "Show all rules, even unmatched ones", false)
  .option("-r, --region", "AWS region to target")
  .description("Tests an event payload against existing rules on a bus")
  .action(async (cmd) => {
    await authHelper.initAuth(cmd);
    await eventTester.testEvent(
      cmd.eventInputFile,
      cmd.namePrefix,
      cmd.eventbus,
      cmd.all
    );
  });
