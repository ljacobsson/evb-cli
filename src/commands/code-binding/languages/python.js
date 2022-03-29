const {
    BooleanOption,
  } = require("quicktype-core/dist/RendererOptions");
  
const pythonOptions = require("quicktype-core/dist/language/Python");

pythonOptions.pythonOptions.justTypes = new BooleanOption(
    "JustTypes",
    null,
    true
  );
  