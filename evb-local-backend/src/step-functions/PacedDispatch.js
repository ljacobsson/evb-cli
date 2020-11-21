const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge();

exports.handler = async function (event, context) {
  const originalEvent = event.OriginalEvent;
  originalEvent.source = event.DispatchSource;
  console.log(event);
  await eventbridge
    .putEvents({
      Entries: [
        {
          Detail: JSON.stringify(originalEvent.detail),
          Source: originalEvent.source,
          Time: originalEvent.time,
          EventBusName: "evb-cli-replaybus",
          DetailType: originalEvent["detail-type"],
          Resources: originalEvent.resources,
        },
      ],
    })
    .promise();
};
