const { v4: uuidv4 } = require('uuid');
const AWS = require("aws-sdk");
const websocket = require('./websocket');

async function initArnListener(arn, target, compact, sam, replaySettings, func) {
  const token = uuidv4();
  const apiId = await websocket.apiId();
  websocket.connect(
    `wss://${apiId}.execute-api.${AWS.config.region}.amazonaws.com/Prod`,
    token,
    null,
    compact,
    sam,
    null,
    arn,
    target,
    null,
    replaySettings,
    func
  );
  console.log('Connecting...');
}

module.exports = {
  init: initArnListener
};
