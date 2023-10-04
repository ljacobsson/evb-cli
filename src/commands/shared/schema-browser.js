const inputUtil = require("./input-util");
const YAML = require("json-to-pretty-yaml");
const { DescribeSchemaCommand, ListSchemasCommand, SchemasClient } = require("@aws-sdk/client-schemas");

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

async function* ListSchemas(schemas, params) {
  let token;
  let errorOccurred = false;

  do {
    const listSchemasParams = {
      ...params,
      NextToken: token,
    };
    const response = await schemas.send(new ListSchemasCommand(listSchemasParams));
    if (!response.$metadata.httpStatusCode || response.$metadata.httpStatusCode !== 200) {
      console.error("Error listing schemas:", response);
      errorOccurred = true;
      break; // Exit the loop in case of an error
    }

    yield response.Schemas;

    ({ NextToken: token } = response);
  } while (token && !errorOccurred);
}

async function getSchema() {
  const schemas = new SchemasClient();
  const { registry, schemaName, sourceName } = await getSchemaName();
  const describeSchemaResponse = await schemas.send(
    new DescribeSchemaCommand({
      RegistryName: registry.id,
      SchemaName: schemaName,
    })
  );
  const schema = JSON.parse(describeSchemaResponse.Content);
  return { sourceName, schema };
}

async function getSchemaName() {
  const schemas = new SchemasClient();
  const registry = await inputUtil.getRegistry(schemas);
  const schemaList = [];
  for await (schemaItem of ListSchemas(schemas, {
    RegistryName: registry.id,
  })) {
    schemaList.push(...schemaItem);
  }
  const sourceName = await inputUtil.getSourceName(schemaList);
  const detailTypeName = await inputUtil.getDetailTypeName(
    schemaList,
    sourceName
  );
  const schemaName = `${sourceName}@${detailTypeName}`.replace(/\//g, "-");
  return { registry, schemaName, sourceName };
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

async function getForPattern(pattern) {
  const schemas = new SchemasClient();
  const registry = await inputUtil.getRegistry();
  const params = {
    SchemaName: `${pattern.source[0]}@${pattern["detail-type"][0].replace(/ /g, "")}`,
    RegistryName: registry.id,
  };
  const schema = await schemas.send(new DescribeSchemaCommand(params));
  return schema;
}

module.exports = {
  deepMerge,
  getSchema,
  outputPattern,
  findCurrent,
  getSchemaName,
  getForPattern
};
