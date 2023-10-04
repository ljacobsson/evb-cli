const schemaBrowser = require("../shared/schema-browser");
const inputUtil = require("../shared/input-util");
const templateParser = require("../shared/template-parser");
const { SchemasClient, ExportSchemaCommand } = require("@aws-sdk/client-schemas");
const jsf = require("json-schema-faker");
const jp = require("jsonpath");
const toJsonSchema = require("to-json-schema");
const fs = require("fs");
const {
  quicktype,
  InputData,
  JSONSchemaInput,
  JSONSchemaStore,
} = require("quicktype-core");
const languages = require("quicktype-core/dist/language/All");
require("./languages/csharp");
require("./languages/typescript");
require("./languages/python");
require("./languages/java");
require("./languages/swift");
async function loadFromRegistry(cmd) {
  const schemas = new SchemasClient();
  const schemaLocation = await schemaBrowser.getSchemaName();
  const schema = await schemas.send(new ExportSchemaCommand({
    RegistryName: schemaLocation.registry.id,
    SchemaName: schemaLocation.schemaName,
    Type: "JSONSchemaDraft4",
  }));
  await generateType(cmd, schema.Content);
}

async function loadFromTemplate(cmd) {
  const schemas = new SchemasClient();

  if (!cmd.registryName) {
    cmd.registryName = (await inputUtil.getRegistry()).id;
  }
  const template = templateParser.load(cmd.template);
  rules = templateParser.getEventRules().map((r) => {
    return { key: r, resource: template.Resources[r] };
  });
  const transforms = [];
  for (const rule of rules) {
    rule.resource.Properties.Targets = rule.resource.Properties.Targets;
    for (const target of rule.resource.Properties.Targets) {
      const tempRule = Object.assign({}, rule);
      tempRule.name = `${rule.key} -> ${target.Id}`;
      transforms.push({ rule: tempRule, target: target });
    }
  }

  addSAMEvents(transforms, template);

  const target = await inputUtil.selectFrom(
    transforms.map((p) => {
      return { name: p.rule.name, value: p };
    }),
    "Select rule/target",
    true
  );
  const source = target.rule.resource.Properties.EventPattern.source;
  const detailType =
    target.rule.resource.Properties.EventPattern["detail-type"];
  const schemaName = `${source}@${detailType}`
    .replace(/\//g, "-")
    .replace(/ /g, "");

  try {
    const describeSchemaResponse = await schemas.send(new ExportSchemaCommand
      ({
        RegistryName: cmd.registryName,
        SchemaName: schemaName,
        Type: "JSONSchemaDraft4",
      }));

    let schema = JSON.parse(describeSchemaResponse.Content);
    if (target.target.InputTransformer) {
      schema = generateSchemaForTransform(schema, target);
    }
    if (target.target.InputPath) {
      schema = generateSchemaForInputPath(schema, target);
    }
    await generateType(cmd, JSON.stringify(schema));
  } catch (err) {
    console.log(err.message);
    return;
  }
}

function addSAMEvents(transforms, template) {
  transforms.push(
    ...templateParser.getSAMEvents(template).map((r) => {
      return {
        rule: {
          name: r.name,
          resource: {
            Properties: {
              EventPattern: r.value.config.Pattern,
              Targets: [
                {
                  Id: r.name,
                  InputPath: r.value.config.InputPath,
                },
              ],
            },
          },
        },
        target: {
          Id: r.name,
          InputPath: r.value.config.InputPath,
        },
      };
    })
  );
}

async function getLanguageInput() {
  return await inputUtil.selectFrom(
    languages.all.map((p) => p.displayName).sort(),
    "Select language. Provide --language <languageName> flag to command to skip",
    true
  );
}

function generateSchemaForInputPath(schema, target) {
  const sampleObject = jsf.generate(schema);
  const node = jp.query(sampleObject, target.target.InputPath)[0];
  return toJsonSchema(node);
}

function generateSchemaForTransform(schema, target) {
  const sampleObject = jsf.generate(schema);
  const pathsMap = target.target.InputTransformer.InputPathsMap;
  for (const key of Object.keys(pathsMap)) {
    pathsMap[key] = jp.query(sampleObject, pathsMap[key])[0];
  }
  const inputTemplate = JSON.parse(
    target.target.InputTransformer.InputTemplate.replace(/[<>]/g, '"')
  );
  for (const key of Object.keys(inputTemplate)) {
    inputTemplate[key] = pathsMap[inputTemplate[key]] || null;
  }
  return toJsonSchema(inputTemplate);
}

async function generateType(cmd, schema) {
  const schemaInput = new JSONSchemaInput(new JSONSchemaStore());

  await schemaInput.addSource({
    name: cmd.typeName,
    schema: schema,
  });

  const inputData = new InputData();
  inputData.addInput(schemaInput);
  const output = (
    await quicktype({
      inputData,
      lang: cmd.language,
    })
  ).lines.join("\n");

  if (cmd.outputFile) {
    fs.writeFileSync(cmd.outputFile, output);
  } else {
    console.log(output);
  }
}

module.exports = {
  loadFromTemplate,
  loadFromRegistry,
  getLanguageInput,
  generateSchemaForInputPath,
  generateSchemaForTransform,
};
