const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
const BACK = "↩ back";
const DONE = "✔ done";
const backNavigation = [BACK, new inquirer.Separator("-------------")];
const doneNavigation = [DONE, new inquirer.Separator("-------------")];
const filterRules = [
  "equals",
  "prefix",
  "anything-but",
  "numeric",
  "exists",
  "null"
];

const numericOperators = [">", "<", "=", ">=", "<=", "!="];

async function getStringValue(fieldName, type) {
  
  const rules = JSON.parse(JSON.stringify(filterRules));
  if (type !== "number") {
    rules.splice(rules.indexOf("numeric"), 1);
  }
  const rule = await prompt({
    name: "id",
    type: "list",
    message: `Enter rule for ${fieldName} matching`,
    choices: [...rules]
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
  if (rule.id === "numeric") {
    const operator = await prompt({
      name: "id",
      type: "list",
      message: `Select operator`,
      choices: numericOperators
    });
    val = [operator.id, val];
  }
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

async function getProperty(currentObject, objectArray) {
  let fieldList = Object.keys(currentObject.properties);
  const property = await prompt({
    name: "id",
    type: "list",
    message: `Add ${objectArray[objectArray.length - 1] ||
      currentObject["x-amazon-events-detail-type"]} item`,
    choices: [...(objectArray.length ? backNavigation : doneNavigation), ...fieldList]
  });
  objectArray.push(property.id);
  const chosenProp = currentObject.properties[property.id];

  return { property, chosenProp };
}

async function getDetailTypeName(schemas, sourceName) {
  const detailTypes = schemas.Schemas.filter(p =>
    p.SchemaName.startsWith(`${sourceName}@`)
  ).map(p => p.SchemaName.split("@")[1]);
  const detailType = await prompt({
    name: "id",
    type: "list",
    message: "Select source",
    choices: detailTypes
  });
  
  const detailTypeName = detailType.id;
  return detailTypeName;
}

async function getSourceName(schemas) {
  const sources = [
    ...new Set(schemas.Schemas.map(p => p.SchemaName.split("@")[0]))
  ];
  const source = await prompt({
    name: "id",
    type: "list",
    message: "Select source",
    choices: sources
  });
  const sourceName = source.id;
  return sourceName;
}

async function getRegistry(schemas) {
  const registriesResponse = await schemas.listRegistries().promise();
  const registries = [
    ...new Set(registriesResponse.Registries.map(p => p.RegistryName))
  ];
  const registry = await prompt({
    name: "id",
    type: "list",
    message: "Select registry",
    choices: registries
  });
  return registry;
}

async function getPropertyValue(chosenProp, property) {
  let answer = undefined;
  switch (chosenProp.type) {
    case "string":
      answer = await getStringValue(property.id, chosenProp.type);
      break;
    // placeholder for dateselector, etc
    default:
      answer = await getStringValue(property.id, chosenProp.type);
  }
  return answer;
}

module.exports = {
  getRegistry,
  getSourceName,
  getDetailTypeName,
  getProperty,
  getPropertyValue,
  BACK,
  DONE
};