const { v4: uuidv4 } = require('uuid');
const websocket = require('./websocket');

async function initArnListener(arn, target, compact, sam) {
  const token = uuidv4();
  const apiId = await websocket.apiId();
  websocket.connect(
    `wss://${apiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/Prod`,
    token,
    null,
    compact,
    sam,
    null,
    arn,
    target
  );
  console.log('Connecting...');
}

module.exports = {
  init: initArnListener
};
