const AWS = require("aws-sdk");
const schemas = new AWS.Schemas();
const inputUtil = require("./input-util");
const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();
const registryName = "discovered-schemas";
run();
async function run() {
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
  console.log(JSON.stringify(pattern, null, 2));

  let currentObject = schema.components.schemas.AWSEvent;
  let pathArray = undefined;
  while (true) {
    let fieldList = Object.keys(currentObject.properties);

    const field = await prompt({
      name: "id",
      type: "list",
      message: `Add ${currentObject} item`,
      choices: fieldList
    });
    const chosenProp = currentObject.properties[field.id];
    const path = chosenProp.$ref;
    if (path) {
      pathArray = path && path.split("/");
    }
    if (path) {
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

    console.log(pathArray);
    if (pathArray && pathArray.length > 2) {
      let obj = {};
      obj[pathArray[pathArray.length - 1]] = {
        ...(obj[pathArray[pathArray.length - 1]], {}),
        ...answer
      };

      for (let i = pathArray.length - 1; i >= 2; i--) {
        obj[pathArray[i]] = {
          ...(obj[pathArray[i]] || {}),
          ...obj[pathArray[i + 1]]
        };
      }
      answer = {};
      answer["detail"] = { ...(pattern["detail"] || {}), ...obj };
    }
    pattern = mergeDeep(pattern, answer);
    console.log("Generated pattern:");
    console.log(JSON.stringify(pattern, null, 2));
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
