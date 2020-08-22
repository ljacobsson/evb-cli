const inputUtil = require("./input-util");
const YAML = require("json-to-pretty-yaml");
const localIntegration = require("../local-integration");

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

async function buildPattern(format, schemas) {
  const { sourceName, schema } = await getSchema(schemas);

  let pattern = init(
    sourceName,
    schema.components.schemas.AWSEvent["x-amazon-events-detail-type"]
  );

  let currentObject = schema.components.schemas.AWSEvent;
  let history = [JSON.parse(JSON.stringify(pattern))];
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
    if (property.id === inputUtil.UNDO) {
      const lastItem = undo(history);
      if (lastItem) {
        pattern = Object.assign({}, lastItem);
      }
      objectArray = [];
      outputPattern(pattern, format);
      continue;
    }
    if (property.id === inputUtil.DONE) {
      outputPattern(pattern, format);
      break;
    }
    const path = chosenProp.$ref;
    if (path) {
      // If property points at reference, go to reference in schema and continue
      currentObject = findCurrent(path, schema);
      if (currentObject.properties) {
        continue;
      }
    }

    let answer = await inputUtil.getPropertyValue(chosenProp, property);

    let current = buildSegment(answer, objectArray);

    pattern = deepMerge(pattern, current);
    outputPattern(pattern, format);
    history.push(Object.assign({}, pattern));
    reset();
  }
  return pattern;

  function undo(history) {
    if (history.length <= 1) {
      return null;
    }
    history.pop();
    return history[history.length - 1];
  }

  function reset() {
    objectArray = [];
    currentObject = schema.components.schemas.AWSEvent;
  }
}

async function buildInputTransformer(format, schemas) {
  const { sourceName, schema } = await getSchema(schemas);

  let currentObject = schema.components.schemas.AWSEvent;

  let objectArray = [];
  const output = {
    InputPathsMap: {},
    InputTemplate: {},
  };
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
      outputPattern(output, format);
      process.exit(0);
    }

    const path = chosenProp.$ref;
    if (path) {
      // If property points at reference, go to reference in schema and continue
      currentObject = findCurrent(path, schema);
      continue;
    }

    const key = await inputUtil.text(
      "Key name",
      objectArray[objectArray.length - 1].replace(/-(\w)/g, ($, $1) =>
        $1.toUpperCase()
      )
    );

    output.InputPathsMap[key] = `$.${objectArray.join(".")}`;
    output.InputTemplate = `{${Object.keys(output.InputPathsMap)
      .map((p) => `"${p}": <${p}>`)
      .join(", ")}}`;

    outputPattern(output, format);
    reset();
  }
  function reset() {
    objectArray = [];
    currentObject = schema.components.schemas.AWSEvent;
  }
}

function outputPattern(output, format) {
  console.log("Generated output:");
  if (!format || format === "json") {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(YAML.stringify(output, null, 2));
  }
}

async function browseEvents(format, schemas, eventbridge) {
  while (true) {
    const { targets } = await getTargets(schemas);
    if (targets.length) {
      while (true) {
        console.log("CTRL+C to exit");
        const target = await inputUtil.selectFrom(
          targets,
          "Select target for more info"
        );

        if (target === inputUtil.BACK) {
          break;
        }

        let details = [{ name: "EventPattern", value: target.pattern }];
        for (const key of Object.keys(target.target)) {
          details.push({ name: key, value: target.target[key] });
        }
        details.push(inputUtil.CONSUME_LOCALLY);
        const detail = await inputUtil.selectFrom(
          details,
          "Select property for more info"
        );
        if (detail === inputUtil.BACK) {
          continue;
        }
        if (detail === inputUtil.CONSUME_LOCALLY) {
          await localIntegration.createLocalConsumer(target);
        }

        console.log("\n" + JSON.stringify(detail, null, 2) + "\n");
      }
    } else {
      console.log("No subscribers found");
    }
  }
}

async function getTargets(schemas) {
  const { schema, sourceName } = await getSchema(schemas);
  const AWS = require("aws-sdk");
  const evb = new AWS.EventBridge();
  const eventBusName = await inputUtil.getEventBusName(evb);
  const targets = [];
  const resp = await evb
    .listRules({ EventBusName: eventBusName, Limit: 100 })
    .promise();
  for (const rule of resp.Rules) {
    if (!rule.EventPattern) {
      continue;
    }
    const pattern = JSON.parse(rule.EventPattern);
    if (
      pattern.source == sourceName &&
      pattern["detail-type"] ==
        schema.components.schemas.AWSEvent["x-amazon-events-detail-type"]
    ) {
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
          value: { pattern, target },
        });
      }
    }
  }
  return { schema, targets };
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
  init,
  deepMerge,
  buildSegment,
  buildPattern,
  buildInputTransformer,
  browseEvents,
};
