const AWS = require("aws-sdk");
const schemas = new AWS.Schemas();
const inputUtil = require("./input-util");
const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
run();
async function run() {
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
  const registryName = registry.id;
  const result = await schemas
    .listSchemas({ RegistryName: registryName })
    .promise();
  const sources = [
    ...new Set(result.Schemas.map(p => p.SchemaName.split("@")[0]))
  ];

  const source = await prompt({
    name: "id",
    type: "list",
    message: "Select source",
    choices: sources
  });
  console.log(source.id);
  const detailTypes = result.Schemas.filter(p =>
    p.SchemaName.startsWith(`${source.id}@`)
  ).map(p => p.SchemaName.split("@")[1]);
  const detailType = await prompt({
    name: "id",
    type: "list",
    message: "Select source",
    choices: detailTypes
  });

  const schemaName = `${source.id}@${detailType.id}`;
  const describeSchemaResponse = await schemas
    .describeSchema({ RegistryName: registryName, SchemaName: schemaName })
    .promise();
  const schema = JSON.parse(describeSchemaResponse.Content);
  let pattern = { source: [source.id], "detail-type": [detailType.id] };

  let currentObject = schema.components.schemas.AWSEvent;
  let pathArray = undefined;
  let objectArray = [];
  while (true) {
    let fieldList = Object.keys(currentObject.properties);

    const field = await prompt({
      name: "id",
      type: "list",
      message: `Add ${currentObject} item`,
      choices: fieldList
    });
    objectArray.push(field.id);
    const chosenProp = currentObject.properties[field.id];
    const path = chosenProp.$ref;
    if (path) {
      pathArray = path && path.split("/");
      pathArray.shift();
      let current = schema;
      for (var node of pathArray) {
        current = current[node];
      }
      currentObject = current;
      continue;
    }

    let answer = undefined;
    switch (chosenProp.type) {
      case "string":
        answer = await inputUtil.string(field.id);
        break;
      default:
        answer = await inputUtil.string(field.id);
    }
    let x = {};
    let current = answer;
    for (let i = objectArray.length - 2; i >= 0; i--) {
      const newObj = {};
      newObj[objectArray[i]] = current;
      x[objectArray[i]] = newObj;
      current = x[objectArray[i]];
    }

    pattern = mergeDeep(pattern, current);
    console.log("Generated pattern:");
    console.log(JSON.stringify(pattern, null, 2));
    pathArray = [];
    objectArray = [];
    
    currentObject = schema.components.schemas.AWSEvent;
  }
}

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}
