const {
    BooleanOption,
  } = require("quicktype-core/dist/RendererOptions");
  
const typeScriptOptions = require("quicktype-core/dist/language/TypeScriptFlow");

typeScriptOptions.tsFlowOptions.justTypes = new BooleanOption(
    "JustTypes",
    null,
    true
  );
  