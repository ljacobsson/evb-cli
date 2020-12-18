const schemaBrowser = require("../shared/schema-browser");
const inputUtil = require("../shared/input-util");

async function buildPattern(format, schemas) {
  const { sourceName, schema } = await schemaBrowser.getSchema(schemas);

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
      schemaBrowser.outputPattern(pattern, format);
      continue;
    }
    if (property.id === inputUtil.DONE) {
      schemaBrowser.outputPattern(pattern, format);
      break;
    }
    const path = chosenProp.$ref;
    if (path) {
      // If property points at reference, go to reference in schema and continue
      currentObject = schemaBrowser.findCurrent(path, schema);
      if (currentObject.properties) {
        continue;
      }
    }

    let answer = await inputUtil.getPropertyValue(chosenProp, property);

    let current = buildSegment(answer, objectArray);

    pattern = schemaBrowser.deepMerge(pattern, current);
    schemaBrowser.outputPattern(pattern, format);
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

function init(source, detailType) {
  return { source: [source], "detail-type": [detailType] };
}

module.exports = {
  buildPattern,
  buildSegment,
  init
};
