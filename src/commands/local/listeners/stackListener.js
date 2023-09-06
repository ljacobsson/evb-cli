const { v4: uuidv4 } = require('uuid');
const AWS = require("aws-sdk");
const websocket = require('./websocket');

async function initStackListener(stackName, compact, sam) {
  const token = uuidv4();
  websocket.connect(
    `wss://${await websocket.apiId()}.execute-api.${AWS.config.region}.amazonaws.com/Prod`,
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
