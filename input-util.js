const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
const filterRules = [
  "equals",
  "prefix",
  "anything-but",
  "numeric",
  "exists",
  "null"
];

async function string(fieldName) {
  const rule = await prompt({
    name: "id",
    type: "list",
    message: `Enter rule for ${fieldName} matching`,
    choices: filterRules
  });
  let val = undefined;
  if (rule.id !== "exists") {
    const value = await prompt({
      name: "id",
      type: "input",
      message: `Enter value for ${fieldName}. Comma separate for array`
    });
    val = value.id.includes(",")
      ? value.id.split(",").map(p => p.trim())
      : value.id;
  } else {
    val = true;
  }
  let returnObj = {};
  let ruleObj = rule.id === "equals" ? val : undefined;
  if (!ruleObj) {
    ruleObj = {};
    ruleObj[rule.id] = val;
  }
  if (!Array.isArray(ruleObj)) {
    returnObj[fieldName] = [];
    returnObj[fieldName].push(ruleObj);
  } else {
    returnObj[fieldName] = ruleObj;
  }

  return returnObj;
}

module.exports = {
  string
};
