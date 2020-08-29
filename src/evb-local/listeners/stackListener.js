const { v4: uuidv4 } = require('uuid');
const websocket = require('./websocket');

async function initStackListener(stackName, compact, sam) {
  const token = uuidv4();
  websocket.connect(
    `wss://${await websocket.apiId()}.execute-api.${process.env.AWS_REGION}.amazonaws.com/Prod`,
    token,
    stackName,
    compact,
    sam
  );
  console.log('Connecting...');
}

module.exports = {
  init: initStackListener
};
