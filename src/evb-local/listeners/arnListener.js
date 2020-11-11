const { v4: uuidv4 } = require('uuid');
const websocket = require('./websocket');
let output = console;

async function initArnListener(arn, target, compact, sam, replayName, func) {
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
    target,
    null,
    replayName,
    func
  );
  console.log('Connecting...');
}

module.exports = {
  init: initArnListener
};
