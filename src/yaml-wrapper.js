const yamlCfn = require("yaml-cfn");

function parse(str) {
  return yamlCfn.yamlParse(str);
}

function stringify(obj) {
  return yamlCfn.yamlDump(obj).replace(/!<(.+?)>/g, "$1");
}

module.exports = {
  parse,
  stringify
};
