const codeBinding = require("./code-binding");
const testSchema = require("../../test-input/aws.codepipeline@CodePipelinePipelineExecutionStateChange-v1.json");

test("Generate schema for InputPath", async () => {
  const subSchema = codeBinding.generateSchemaForInputPath(testSchema, {
    target: { InputPath: "$.detail" },
  });
  expect(subSchema.type).toBe("object");
  expect(subSchema.properties.pipeline.type).toBe("string");
});

test("Generate schema for InputTransformer", async () => {
  const subSchema = codeBinding.generateSchemaForTransform(testSchema, {
    target: { InputTransformer: {
      InputPathsMap: {
        AccountId: "$.account",
        Pipeline: "$.detail.pipeline",
        Time: "$.time"
      },
      "InputTemplate":`{"AccountId": <AccountId>, "PipelineName": <Pipeline>, "Time": <Time>}`
    } },
  });

  expect(subSchema.type).toBe("object");
  expect(subSchema.properties.PipelineName.type).toBe("string");
  expect(subSchema.properties.Time.type).toBe("string");
  expect(subSchema.properties.Time.format).toBe("date-time");
  expect(subSchema.properties.AccountId.type).toBe("string");
});
