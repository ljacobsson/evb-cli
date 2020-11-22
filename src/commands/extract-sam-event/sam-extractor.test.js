const samExtractor = require("./sam-extractor");
const templateParser = require("../shared/template-parser");
const inputUtil = require("../shared/input-util");
const path = require("path");

test("Extracts sam event to rule", async () => {
  inputUtil.selectFrom = jest.fn((events, message, skipBack) => {
    return new Promise((resolve, reject) => {
      resolve({
        function: events[0].value.function,
        event: events[0].value.event,
        config: events[0].value.config,
      });
    });
  });
  inputUtil.text = jest.fn((message, suggestion) => {
    return new Promise((resolve, reject) => {
      resolve(suggestion);
    });
  });
  templateParser.saveTemplate = jest.fn(() => {});
  const template = await templateParser.load(
    path.join(__dirname, "..", "..", "test-input", "test-template.yaml")
  );
  const originalTemplate = JSON.parse(JSON.stringify(template));
  console.log(originalTemplate);
  await samExtractor.extractSamDefinition(template);
  console.log(originalTemplate);
  expect(template.Resources.MyEventRule).toBeTruthy();
  expect(template.Resources.MyEventRule.Properties.EventPattern).toEqual(
    originalTemplate.Resources.MyFunction.Properties.Events.MyEvent.Properties
      .Pattern
  );
  expect(template.Resources.MyEventRule.Properties.Targets[0].InputPath).toEqual(
    originalTemplate.Resources.MyFunction.Properties.Events.MyEvent.Properties
      .InputPath
  );
  expect(template.Resources.MyEventRulePermission).toBeTruthy();
});
