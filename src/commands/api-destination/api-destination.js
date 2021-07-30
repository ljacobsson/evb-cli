const axios = require("axios");
const inquirer = require("inquirer");
const inputUtil = require("../shared/input-util");
const templateParser = require("../shared/template-parser");
const schemaBrowser = require("../shared/schema-browser");
const inputTransformerBuilder = require("../input/input-transformer-builder");
const { option } = require("commander");
const { yamlParse } = require("yaml-cfn");

function validateTemplateExists(cmd) {
  // eslint-disable-line no-unused-vars
  const templateName = cmd.template;
  const template = templateParser.load(templateName, true);
  if (!template) {
    throw new Error(`Template "${templateName}" does not exist.`);
  }
}

async function create(cmd) {
  try {
    validateTemplateExists(cmd);
  } catch (err) {
    console.log(err.message);
    return;
  }
  let oad;
  try {
    oad = await axios.get(cmd.url);
  } catch (err) {
    console.log(err.message);
    return;
  }
  if (typeof oad.data === "string") {
    oad.data = yamlParse(oad.data);
  }

  const path = await inputUtil.selectFrom(
    Object.keys(oad.data.paths).map((p) => {
      return {
        name: `${p} [${Object.keys(oad.data.paths[p])
          .filter((p) =>
            [
              "get",
              "head",
              "post",
              "put",
              "delete",
              "options",
              "trace",
              "patch",
            ].includes(p.toLowerCase())
          )
          .join(",")}]`,
        value: p,
      };
    }),
    "Select the path to create an API destination for",
    true
  );

  const methods = Object.keys(oad.data.paths[path]).filter((p) =>
    [
      "get",
      "head",
      "post",
      "put",
      "delete",
      "options",
      "trace",
      "patch",
    ].includes(p.toLowerCase())
  );
  const template = templateParser.load(cmd.template, true);
  cmd.format = templateParser.templateFormat();
  let method = methods[0];

  if (methods.length > 1) {
    method = await inputUtil.selectFrom(methods, "Select method", true, "list");
  }
  let required, optional;
  if (oad.data.paths[path][method].parameters) {
    required = oad.data.paths[path][method].parameters.filter(
      (p) => p.required && p.in
    );
    optional = oad.data.paths[path][method].parameters.filter(
      (p) => !p.required && p.in
    );
  }
  let schema;
  let eventRuleName;
  if (template) {
    const events = templateParser.getEventRules();
    if (!events.length) {
      console.log("No 'AWS::Events::Rule' found in template");
      return;
    }
    if (events.length > 1) {
      // eslint-disable-line no-magic-numbers
      eventRuleName = await inputUtil.selectFrom(
        events,
        "Select event to add destination to",
        true,
        "list"
      );
    } else {
      eventRuleName = events[0];
    }
    try {
      const schemaResponse = await schemaBrowser.getForPattern(
        template.Resources[eventRuleName].Properties.EventPattern
      );
      schema = JSON.parse(schemaResponse.Content);
    } catch (err) {
      console.log(err.message);
      if (err.message.includes("does not exist")) {
        console.log("Please make sure it exists in the selected registry."); 
      }
      return;
    }
  }

  const options = ["Preview", "Done"];
  if (required && required.length) {
    options.push(
      new inquirer.Separator("Required"),
      ...required.map((p) => {
        return { name: `${p.name} (${p.in})`, value: p };
      })
    );
  }
  if (optional && optional.length) {
    options.push(
      new inquirer.Separator("Optional"),
      ...optional.map((p) => {
        return { name: `${p.name} (${p.in})`, value: p };
      }),
      new inquirer.Separator("********")
    );
  }

  let value;
  let currentTransform;
  let httpParameters;
  do {
    const option = await inputUtil.selectFrom(
      options,
      "Select parameter",
      true,
      "list"
    );

    if (option.description) {
      console.log(option.description);
    }
    if (option === "Done") {
      break;
    }
    if (option === "Preview") {
      schemaBrowser.outputPattern(currentTransform, cmd.format);
      continue;
    }
    const valueSource = await inputUtil.selectFrom(
      ["Event mapping", "Static value"],
      true,
      "list"
    );
    if (valueSource === "Event mapping") {
      const transformer = await inputTransformerBuilder.buildForSchema(
        cmd.format,
        schema,
        option.name,
        currentTransform
      );
      if (["body", "formdata"].includes(option.in.toLowerCase())) {
        currentTransform = transformer.output;
      } else {
        value = transformer.path;
      }
    } else {
      value = await inputUtil.text(
        `Value for ${option.name} (${option.type || "string"})`
      );
      if (["body", "formdata"].includes(option.in.toLowerCase())) {
        currentTransform = appendToTransform(currentTransform, option, value);
      }
    }

    if (option.in.toLowerCase().startsWith("query")) {
      httpParameters = appendHttpParameters(
        httpParameters,
        option,
        value,
        "QueryStringParameters"
      );
    }
    if (option.in.toLowerCase().startsWith("header")) {
      httpParameters = appendHttpParameters(
        httpParameters,
        option,
        value,
        "HeaderParameters"
      );
    }
    if (option.in.toLowerCase().startsWith("path")) {
      httpParameters = appendHttpParameters(
        httpParameters,
        option,
        value,
        "PathParameterValues"
      );
    }
  } while (true);
  console.log(
    "About to generate `AWS::Events::Connection` and `AWS::Events::ApiDestination` resources. How do you want to prefix these?"
  );
  const resourcePrefix = await inputUtil.text(
    "Resource prefix",
    oad.data.info.title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)
  );

  const authType = await getAuthTypeCfn(resourcePrefix);

  template.Resources[`${resourcePrefix}Connection`] = {
    Type: "AWS::Events::Connection",
    Properties: authType,
  };
  template.Resources[`${resourcePrefix}Destination`] = {
    Type: "AWS::Events::ApiDestination",
    Properties: {
      ConnectionArn: { "Fn::GetAtt": [`${resourcePrefix}Connection`, "Arn"] },
      InvocationEndpoint: `https://${oad.data.host}/api${path}`,
      HttpMethod: method.toUpperCase(),
      InvocationRateLimitPerSecond: 10,
    },
  };
  template.Resources[`${resourcePrefix}InvokeRole`] = {
    Type: "AWS::IAM::Role",
    Properties: {
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["events.amazonaws.com"],
            },
            Action: ["sts:AssumeRole"],
          },
        ],
      },
      Policies: [
        {
          PolicyName: "AllowAPIdestinationAccess",
          PolicyDocument: {
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: "events:InvokeApiDestination",
                Resource: { "Fn::GetAtt": [`${resourcePrefix}Destination`, "Arn"] },
              },
            ],
          },
        },
      ],
    },
  };

  template.Resources[eventRuleName].Properties.Targets =
    template.Resources[eventRuleName].Properties.Targets || [];
  const target = {
    Arn: { "Fn::GetAtt": [`${resourcePrefix}Destination`, "Arn"] },
    RoleArn: { "Fn::GetAtt": [`${resourcePrefix}InvokeRole`, "Arn"] },
    Id: `${resourcePrefix}Target`,
  };
  if (currentTransform) {
    target.InputTransformer = currentTransform;
  }
  if (httpParameters) {
    target.HttpParameters = httpParameters;
  }

  template.Resources[eventRuleName].Properties.Targets.push(target);

  templateParser.saveTemplate();
}

async function getAuthTypeCfn(resourcePrefix) {
  return await inputUtil.selectFrom(
    [
      {
        name: "API_KEY",
        value: {
          AuthorizationType: "API_KEY",
          AuthParameters: {
            ApiKeyAuthParameters: {
              ApiKeyName: "Authorization",
              ApiKeyValue: `{{resolve:secretsmanager:${resourcePrefix}-auth/Credentials:SecretString:ApiKey}}`,
            },
          },
        },
      },
      {
        name: "BASIC",
        value: {
          AuthorizationType: "BASIC",
          AuthParameters: {
            BasicAuthParameters: {
              Username: `{{resolve:secretsmanager:${resourcePrefix}-auth/Credentials:SecretString:Username}}`,
              Password: `{{resolve:secretsmanager:${resourcePrefix}-auth/Credentials:SecretString:Password}}`,
            },
          },
        },
      },
      {
        name: "OAUTH_CLIENT_CREDENTIALS",
        value: {
          AuthorizationType: "OAUTH_CLIENT_CREDENTIALS",
          AuthParameters: {
            OAuthParameters: {
              ClientParameters: {
                ClientId: `{{resolve:secretsmanager:${resourcePrefix}-auth/Credentials:SecretString:ClientId}}`,
                ClientSecret: `{{resolve:secretsmanager:${resourcePrefix}-auth/Credentials:SecretString:ClientSecret}}`,
              },
              AuthorizationEndpoint:
                "https://yourUserName.us.auth0.com/oauth/token",
              HttpMethod: "POST",
            },
          },
        },
      },
    ],
    "Select authorization type",
    true,
    "list"
  );
}

function appendHttpParameters(httpParameters, option, value, parameterName) {
  httpParameters = httpParameters || {};
  httpParameters[parameterName] = httpParameters[parameterName] || {};
  httpParameters[parameterName][option.name] = value;
  return httpParameters;
}

function appendToTransform(currentTransform, option, value) {
  currentTransform = currentTransform || {};
  currentTransform.InputTemplate = currentTransform.InputTemplate || "{}";
  const inputTemplate = JSON.parse(currentTransform.InputTemplate);
  inputTemplate[option.name] = value;
  currentTransform.InputTemplate = JSON.stringify(inputTemplate);
  return currentTransform;
}

module.exports = {
  create,
};
