const AWS = require("aws-sdk");
require("@mhlabs/aws-sdk-sso");

function initAuth(cmd) {

  const credentials = new AWS.SharedIniFileCredentials({ profile: cmd.profile });
  console.log(credentials);
  if (credentials.accessKeyId) {
    AWS.config.credentials = credentials;
  } else {
    process.env.AWS_PROFILE = cmd.profile || process.env.AWS_PROFILE || "default";
    process.env.AWS_REGION = cmd.region || process.env.AWS_REGION || AWS.config.region
    AWS.config.credentialProvider.providers.unshift(
      new AWS.SingleSignOnCredentials()
    );
  }
}

module.exports = {
  initAuth
}

