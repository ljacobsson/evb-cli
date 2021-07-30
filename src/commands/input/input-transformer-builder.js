const patternBuilder = require("../shared/schema-browser");
const inputUtil = require("../shared/input-util");

async function build(format, schemas) {
  const { schema } = await patternBuilder.getSchema(schemas);
  buildForSchema(format, schema, null, null, true);
}

async function buildForSchema(format, schema, keyName, input, showOutput) {
  function reset() {
    objectArray = [];
    currentObject = schema.components.schemas.AWSEvent;
  }

  let currentObject = schema.components.schemas.AWSEvent;

  let objectArray = [];
  const output = input || {
    InputPathsMap: {},
    InputTemplate: {},
  };
  let path;
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

    path = chosenProp.$ref;
    if (path) {
      // If property points at reference, go to reference in schema and continue
      currentObject = patternBuilder.findCurrent(path, schema);
      continue;
    }

    const key =
      keyName ||
      (await inputUtil.text(
        "Key name",
        objectArray[objectArray.length - 1].replace(/-(\w)/g, ($, $1) =>
          $1.toUpperCase()
        )
      ));
    output.InputPathsMap = output.InputPathsMap || {};
    output.InputPathsMap[key] = `$.${objectArray.join(".")}`;
    const inputTemplateJson = Object.keys(output.InputPathsMap).map((p) => {
      return [p, `<${p}>`];
    });
    output.InputTemplate = JSON.stringify({
      ...Object.fromEntries(inputTemplateJson),
      ...JSON.parse(input?.InputTemplate || "{}"),
    });
    if (showOutput) {
      patternBuilder.outputPattern(output, format);
    }
    const jsonPath = `$.${objectArray.join(".")}`;
    reset();
    return { output, keyName, path: jsonPath };
  }
}

module.exports = {
  build,
  buildForSchema,
};
