const AWS = require("aws-sdk");
const schemas = new AWS.Schemas();
const inputUtil = require("./input-util");
const patternBuilder = require("./pattern-builder");

async function run() {

  const registry = await inputUtil.getRegistry(schemas);
  const schemaResponse = await schemas
    .listSchemas({ RegistryName: registry.id })
    .promise();

  const sourceName = await inputUtil.getSourceName(schemaResponse);
  const detailTypeName = await inputUtil.getDetailTypeName(
    schemaResponse,
    sourceName
  );
  const schemaName = `${sourceName}@${detailTypeName}`;

  const describeSchemaResponse = await schemas
    .describeSchema({ RegistryName: registry.id, SchemaName: schemaName })
    .promise();

  const schema = JSON.parse(describeSchemaResponse.Content);

  let pattern = patternBuilder.init(sourceName, detailTypeName);

  let currentObject = schema.components.schemas.AWSEvent;

  let objectArray = [];
  while (true) {
  
    const { property, chosenProp } = await inputUtil.getProperty(
      currentObject,
      objectArray
    );
    if (property.id === inputUtil.BACK) {
      reset();
      continue;
    }
    if (property.id === inputUtil.DONE) {
      outputPattern();
      process.exit(0);
    } 

    const path = chosenProp.$ref;
    if (path) {
      // If property points at reference, go to reference in schema and continue
      currentObject = findCurrent(path, schema);
      continue;
    }

    let answer = await inputUtil.getPropertyValue(chosenProp, property);

    let current = patternBuilder.buildSegment(answer, objectArray);

    pattern = patternBuilder.deepMerge(pattern, current);
    outputPattern();
    reset();
  }

  function reset() {
    objectArray = [];
    currentObject = schema.components.schemas.AWSEvent;
  }

  function outputPattern() {
    console.log("Generated pattern:");
    console.log(JSON.stringify(pattern, null, 2));
  }
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

run();
