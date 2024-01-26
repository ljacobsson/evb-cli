const { fromSSO } = require("@aws-sdk/credential-provider-sso");
const samconfigParser = require("./sam-config-parser");
async function initAuth(cmd) {

  process.env.AWS_REGION = cmd.region || process.env.AWS_REGION;
  if (process.env.AWS_REGION === "undefined") {
    const config = await samconfigParser.parse();
    if (config.region) {
      console.log(`Using region from samconfig: ${config.region}`);
      process.env.AWS_REGION = config.region;
      cmd.region = config.region;
    } else {
      console.error("Missing required option: --region or AWS_REGION environment variable");
      process.exit(1);
    }
  }

  try {
    const credentials = await fromSSO({ profile: cmd.profile })();
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
    process.env.AWS_SESSION_TOKEN = credentials.sessionToken;
  } catch (err) {
    // ignore and use default auth chain
  }
}

module.exports = {
  initAuth
}

