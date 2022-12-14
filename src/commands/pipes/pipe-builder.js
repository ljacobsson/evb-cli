const supportedTypes = require("./pipes-config.json");
const pipesSchema = require("./pipes-cfn-schema.json")
const templateParser = require("../shared/template-parser");
const inputUtil = require("../shared/input-util")
let cmd;
async function build(command) {
  cmd = command;
  const templateName = cmd.template;
  const template = templateParser.load(templateName, true);
  if (!template) {
    throw new Error(`Template "${templateName}" does not exist.`);
  }
  const compatibleSources = await getSources(template);
  const sourceChoices = compatibleSources.map(p => { return { name: `[${template.Resources[p].Type}] ${p}`, value: { name: p, type: template.Resources[p].Type } } }).sort((a, b) => a.name > b.name ? 1 : -1);
  let source = await inputUtil.selectFrom([...sourceChoices, "Not templated"], "Select source", true);

  if (source === "Not templated") {
    const allTypes = supportedTypes.filter(p => !p.Type.includes("Serverless") && p.Source).map(p => p.Type)
    const type = await inputUtil.selectFrom(allTypes, "Select resource type", true);
    arn = await inputUtil.text("Enter ARN")
    source = { type: type, arn: arn, name: type.split(":")[1] }
  }
  const sourceConfig = supportedTypes.find(p => p.Type === source.type);
  const sourceObj = await buildParametersForSide(sourceConfig.SourceSchemaName);

  const compatibleTargets = await getTargets(template, source);
  const targetChoices = compatibleTargets.map(p => { return { name: `[${template.Resources[p].Type}] ${p}`, value: { name: p, type: template.Resources[p].Type } } }).sort((a, b) => a.name > b.name ? 1 : -1);
  let target = await inputUtil.selectFrom([...targetChoices, "Not templated"], "Select target", true);
  if (target === "Not templated") {
    const allTypes = supportedTypes.filter(p => !p.Type.includes("Serverless") && p.Target).map(p => p.Type)
    const type = await inputUtil.selectFrom(allTypes, "Select resource type", true);
    arn = await inputUtil.text("Enter ARN")
    target = { type: type, arn: arn, name: type.split(":")[1] }
  }
  const targetConfig = supportedTypes.find(p => p.Type === target.type);
  const targetObj = await buildParametersForSide(targetConfig.TargetSchemaName);  
  const sourcePropertyName = sourceConfig.SourceSchemaName.replace("PipeSource", "");
  const targetPropertyName = targetConfig.TargetSchemaName.replace("PipeTarget", "");
  const pipeName = `${source.name}To${target.name}Pipe`;
  template.Resources[pipeName] = {
    Type: "AWS::Pipes::Pipe",
    Properties: {
      Name: {
        "Fn::Sub": "${AWS::StackName}-" + pipeName
      },
      RoleArn: { "Fn::GetAtt": [`${pipeName}Role`, "Arn"] },
      Source: source.arn || JSON.parse(JSON.stringify(sourceConfig.ArnGetter).replace("#RESOURCE_NAME#", source.name)),
      Target: target.arn || JSON.parse(JSON.stringify(targetConfig.ArnGetter).replace("#RESOURCE_NAME#", target.name))
    }
  }
  if (Object.keys(sourceObj).length)
    template.Resources[pipeName].Properties["SourceParameters"] = { [sourcePropertyName]: sourceObj };

  if (Object.keys(targetObj).length)
    template.Resources[pipeName].Properties["TargetParameters"] = { [targetPropertyName]: targetObj };


  const role = {
    Type: "AWS::IAM::Role",
    Properties: {
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: [
                "pipes.amazonaws.com"
              ]
            },
            Action: [
              "sts:AssumeRole"
            ]
          }
        ]
      },
      Policies: [
        {
          PolicyName: "LogsPolicy",
          PolicyDocument: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "logs:CreateLogStream",
                  "logs:CreateLogGroup",
                  "logs:PutLogEvents"],
                Resource: "*"
              },
            ],
          }
        }
      ]
    }
  };
  sourceConfig.SourcePolicy.Statement[0].Resource = source.arn || JSON.parse(JSON.stringify((sourceConfig.SourcePolicy.Statement[0].Resource || sourceConfig.ArnGetter)).replace(/#RESOURCE_NAME#/g, source.name));
  targetConfig.TargetPolicy.Statement[0].Resource = target.arn || JSON.parse(JSON.stringify((targetConfig.TargetPolicy.Statement[0].Resource || targetConfig.ArnGetter)).replace(/#RESOURCE_NAME#/g, target.name));
  role.Properties.Policies.push({
    PolicyName: "SourcePolicy",
    PolicyDocument: sourceConfig.SourcePolicy
  }, {
    PolicyName: "TargetPolicy",
    PolicyDocument: targetConfig.TargetPolicy
  })
  template.Resources[`${pipeName}Role`] = role
  templateParser.saveTemplate();
}

async function buildParametersForSide(definitionName) {
  const schema = pipesSchema.definitions[definitionName];
  const obj = {};
  if (schema) {
    await buildParameters(obj, schema);
  }

  return obj;
}

async function buildParameters(obj, schema, propName, prefix, isRequired) {
  prefix = prefix || "";
  let settings = [];
  if (schema.type === "object") {
    settings.push(...Object.keys(schema.properties));
  } else {
    settings = [schema];
  }
  for (const setting of settings) {
    if (!propName) propName = setting;
    isRequired = isRequired || schema.required && schema.required.includes(setting);
    let optionalityString = "(leave blank to skip)"
    if (isRequired) {
      optionalityString = "(required)";
    } else if (!cmd.guided) {
      continue;
    }
    let validationString = "";
    const property = schema.properties && schema.properties[setting] || setting;
    if (property.maximum && property.minimum) {
      validationString += ` (${property.minimum} - ${property.maximum})`;
    }

    if (property["$ref"]) {
      const name = property.$ref.split("/").slice(-1)[0];
      obj[setting] = obj[setting] || {};
      const type = await buildParameters(obj[setting], pipesSchema.definitions[name], setting, prefix + setting + ".", isRequired);
      if (type === "enum") {
        obj[setting] = obj[setting][setting];
      }
    } else if (property.enum) {
      if (!isRequired) {
        property.enum.push("Skip");
      }

      const input = await inputUtil.selectFrom(property.enum, `Select value for ${propName}`, true)
      if (input === "Skip") {
        continue;
      }
      obj[propName] = input;
      return "enum";
    } else if (property.type === "array") {
      const input = await inputUtil.text(`Enter values for ${prefix}${setting}${validationString}. Seperate with comma. ${optionalityString}`);
      if (input) {
        obj[setting] = input.split(",").map(x => x.trim());
      }
    }
    else {
      let input = await inputUtil.text(`Enter value for ${prefix}${setting}${validationString} ${optionalityString}`)
      if (input) {
        if (property.type === "integer") {
          input = parseInt(input);
        } else if (property.type === "boolean") {
          input = input.toLowerCase() === "true";
        }
        obj[setting] = input;
      }
    }
  }
}

async function getSources(template) {
  const types = supportedTypes.map(p => p.Type)
  return Object.keys(template.Resources).filter(p => types.includes(template.Resources[p].Type) && supportedTypes.find(q => q.Type === template.Resources[p].Type).Source)
}

async function getTargets(template, source) {
  const types = supportedTypes.map(p => p.Type)
  return Object.keys(template.Resources).filter(p => types.includes(template.Resources[p].Type) && supportedTypes.find(q => q.Type === template.Resources[p].Type).Target && p !== source)
}


module.exports = {
  build,
};
