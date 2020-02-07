const AWS = require("aws-sdk");
const schemas = new AWS.Schemas();
const inputUtil = require("./input-util");
const YAML = require("json-to-pretty-yaml");

function init(source, detailType) {
    return { source: [source], "detail-type": [detailType] };
}

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
  

  function buildSegment(answer, objectArray) {
    let x = {};
    let current = answer;
    for (let i = objectArray.length - 2; i >= 0; i--) {
      const newObj = {};
      newObj[objectArray[i]] = current;
      x[objectArray[i]] = newObj;
      current = x[objectArray[i]];
    }
    return current;
  }

  async function buildPattern(format) {
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
  
    let pattern = init(sourceName, schema.components.schemas.AWSEvent["x-amazon-events-detail-type"]);
  
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
        outputPattern(format);
        process.exit(0);
      }
  
      const path = chosenProp.$ref;      
      if (path) {
        // If property points at reference, go to reference in schema and continue
        currentObject = findCurrent(path, schema);
        continue;
      }
  
      let answer = await inputUtil.getPropertyValue(chosenProp, property);
  
      let current = buildSegment(answer, objectArray);
  
      pattern = deepMerge(pattern, current);
      outputPattern(format);
      reset();
    }
  
    function reset() {
      objectArray = [];
      currentObject = schema.components.schemas.AWSEvent;
    }
  
    function outputPattern(format) {
      console.log("Generated pattern:");
      if (!format || format === "json") {
        console.log(JSON.stringify(pattern, null, 2));
      } else {
        console.log(YAML.stringify(pattern, null, 2));
      }
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
  

module.exports = {
    init,
    deepMerge,
    buildSegment,
    buildPattern
}