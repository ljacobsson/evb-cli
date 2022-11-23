const AWS = require("aws-sdk");
require("@mhlabs/aws-sdk-sso");

function initAuth(cmd) {

  const credentials = new AWS.SharedIniFileCredentials({ profile: cmd.profile });
  if (credentials.accessKeyId) {
    AWS.config.credentials = credentials;
  } else {
    process.env.AWS_PROFILE = cmd.profile || process.env.AWS_PROFILE || "default";
    AWS.config.credentialProvider.providers.unshift(
      new AWS.SingleSignOnCredentials()
    );
  }
  process.env.AWS_REGION = cmd.region || process.env.AWS_REGION || AWS.config.region
}

module.exports = {
  initAuth
}

