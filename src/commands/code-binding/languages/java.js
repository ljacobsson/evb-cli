const {
    BooleanOption,
  } = require("quicktype-core/dist/RendererOptions");
  
const options = require("quicktype-core/dist/language/Java");

options.javaOptions.justTypes = new BooleanOption(
  "JustTypes",
  null,
  true
);
options.javaOptions.useList = new BooleanOption(
  "UseList",
  null,
  true
);
