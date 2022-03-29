const {
    BooleanOption,
  } = require("quicktype-core/dist/RendererOptions");
  
const options = require("quicktype-core/dist/language/Swift");

options.swiftOptions.justTypes = new BooleanOption(
  "JustTypes",
  null,
  true
);
