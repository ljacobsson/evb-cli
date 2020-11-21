const patternBuilder = require("../shared/schema-browser");
const inputUtil = require("../shared/input-util");

async function build(format, schemas) {
  const { sourceName, schema } = await patternBuilder.getSchema(schemas);

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
      patternBuilder.outputPattern(output, format);
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

    patternBuilder.outputPattern(output, format);
    reset();
  }
  function reset() {
    objectArray = [];
    currentObject = schema.components.schemas.AWSEvent;
  }
}


module.exports = {
    build
}