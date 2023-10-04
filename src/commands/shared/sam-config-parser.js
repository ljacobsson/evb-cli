const toml = require('toml');
const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

function parse() {
  const foundSamconfigFile = findConfigFile();
  if (foundSamconfigFile === null) {
    return {};
  }

  const configEnv = 'default';
  let config;
  const type = path.extname(foundSamconfigFile);

  switch(type) {
    case '.toml':
      config = toml.parse(fs.readFileSync(foundSamconfigFile, 'utf-8'));
      break;
    case '.yaml':
      config = yaml.parse(fs.readFileSync(foundSamconfigFile, 'utf-8')); 
      break;
  }

  const envConfig = config[configEnv].deploy.parameters;
  envConfig.configEnv = process.env.configEnv || 'default';
  envConfig.stack_name = envConfig.stack_name || config[configEnv].global.parameters.stack_name
  envConfig.region = envConfig.region || config[configEnv].global.parameters.region || process.env.AWS_REGION;
  envConfig.profile = envConfig.profile || config[configEnv].global?.parameters.profile || process.env.AWS_PROFILE || 'default';
  return envConfig;
}

function findConfigFile() {
  const defaultSamconfigFiles = ['samconfig.toml', 'samconfig.yaml'];
  for (const file of defaultSamconfigFiles) {
    if (fs.existsSync(file)){
      return file;
    }
  }
  return null;
}

function configExists() {
  return findConfigFile() ? true : false;
}

module.exports = {
  parse,
  configExists,
  findConfigFile
}