const inputUtil = require("./input-util");
const YAML = require("json-to-pretty-yaml");

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function outputPattern(output, format) {
  console.log("Generated output:");
  if (!format || format === "json") {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(YAML.stringify(output, null, 2));
  }
}

async function getSchema(schemas) {
  const registry = await inputUtil.getRegistry(schemas);
  const schemaResponse = await schemas
    .listSchemas({ RegistryName: registry.id })
    .promise();
  const sourceName = await inputUtil.getSourceName(schemaResponse);
  const detailTypeName = await inputUtil.getDetailTypeName(
    schemaResponse,
    sourceName
  );
  const schemaName = `${sourceName}@${detailTypeName}`.replace(/\//g, "-");
  const describeSchemaResponse = await schemas
    .describeSchema({ RegistryName: registry.id, SchemaName: schemaName })
    .promise();
  const schema = JSON.parse(describeSchemaResponse.Content);
  return { sourceName, schema };
}

function findCurrent(path, schema) {
  const pathArray = path.split("/");
  pathArray.shift(); // Remove leading #
  let current = schema;
  for (var node of pathArray) {
    current = current[node];
  }
  return current;
}


module.exports = {
  deepMerge,
  getSchema,
  outputPattern,
  findCurrent
};
