const AWS = require("aws-sdk");
const schemas = new AWS.Schemas();
const inputUtil = require("./input-util");
const languages = ["Java8", "Python36", "TypeScript3"];
const inquirer = require("inquirer");
const prompt = inquirer.createPromptModule();

async function browse(l) {
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

  const language = await prompt({
    name: "id",
    type: "list",
    message: `Select language`,
    choices: languages
  });

  const source = await schemas.getCodeBindingSource({ Language: language.id, SchemaName:schemaName, RegistryName: registry.id, SchemaVersion:"1" }).promise();
  console.log(source.Body.toString());
}
module.exports = {
  browse
};
