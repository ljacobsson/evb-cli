const jp = require("jsonpath");
const AWS = require("aws-sdk");
const inputUtil = require("../shared/input-util");
const yaml = require("js-yaml");
const Spinner = require("cli-spinner").Spinner;
const open = require("open");
var link2aws = require('link2aws');
async function find(cmd) {
  if (!cmd.filters) {
    console.log("Please specify at least one filter with -f. See --help for more info");
    return;
  }
  const evb = new AWS.EventBridge();
  const filters = cmd.filters.split(",").map((p) => p.trim()).filter((p) => p && p.length > 0);
  let nextToken = null;
  const allRules = [];
  const spinner = new Spinner();
  spinner.setSpinnerString("⠁⠁⠉⠙⠚⠒⠂⠂⠒⠲⠴⠤⠄⠄⠤⠠⠠⠤⠦⠖⠒⠐⠐⠒⠓⠋⠉⠈⠈");
  spinner.start();
  
  do {
    const rules = await evb.listRules({
      EventBusName: cmd.eventbus,
      NextToken: nextToken,
    }).promise();
       
    allRules.push(...rules.Rules);
    nextToken = rules.NextToken;
  } while (nextToken);
  const matchedRules = [];
  for (const rule of allRules) {
    if (rule.EventPattern) {
      const pattern = JSON.parse(rule.EventPattern);
      if (filters.every((filter) => {
        let [path, value] = filter.split("=");
        if (path.includes("-")) {
          path = path.split(".").map(p => p.includes("-") ? `["${p}"]` : p).join("");
        }
        return jp.query(pattern, path).length > 0 && jp.query(pattern, path).find(p => {
          const str = JSON.stringify(p);          
          let isMatch = false;
          isMatch = str.match(new RegExp(value, "g"))?.length > 0;

          if (Array.isArray(p)) {
            for (const item of p) {
              isMatch = isMatch || typeof(item) === "string" && item.match(new RegExp(value, "g"))?.length > 0;
            }
          }
          return isMatch > 0;
        });
      })) {
        const targets = await getTargets(evb, rule, cmd.eventbus);
        matchedRules.push({ name: rule.Name, children: targets });
      }
    }
  }
  spinner.stop();

  if (matchedRules.length === 0) {
    console.log("No rules found");
    return;
  }

  const target = await inputUtil.tree("Select target for more info. Use <space> to expand node.", matchedRules, true);
  if (target.action === "open-url") {
    try {
      await open(new link2aws.ARN(target.result).consoleLink);
    } catch (e) {
      console.log("Could not find URL to target ARN: " + target.result);
    }
  } else {
    console.log(target.result);
  }
}
async function getTargets(evb, rule, eventBusName) {
  const targets = [];
  const targetResponse = await evb
    .listTargetsByRule({
      Rule: rule.Name,
      EventBusName: eventBusName,
    })
    .promise();
  for (const target of targetResponse.Targets) {
    const arnSplit = target.Arn.split(":");
    const service = arnSplit[2];
    const name = arnSplit[arnSplit.length - 1];
    targets.push({
      name: `${service}: ${name}`,
      children: [{
        name: "Show event pattern",
        value: { result: yaml.dump(JSON.parse(rule.EventPattern)), action: "print" }
      }, {
        name: "Open target in console: " + target.Arn,
        value: { result: target.Arn, action: "open-url" }
      }],
    });
  }
  return targets;
}



module.exports = {
  find,
};
