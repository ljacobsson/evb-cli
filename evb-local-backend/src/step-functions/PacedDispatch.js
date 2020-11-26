const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge();

exports.handler = async function (event, context) {
  const originalEvent = event.OriginalEvent;
  originalEvent.source = event.DispatchSource;
  console.log(event);
  console.log({
    Detail: JSON.stringify(originalEvent.detail),
    Source: event.ReplayName,
    Time: originalEvent.time,
    EventBusName: event.EventBusName || "evb-cli-replaybus",
    DetailType: originalEvent["detail-type"],
    Resources: originalEvent.resources,
  });
  await eventbridge
    .putEvents({
      Entries: [
        {
          Detail: JSON.stringify(originalEvent.detail),
          Source: event.ReplayName,
          Time: originalEvent.time,
          EventBusName: event.EventBusName || "evb-cli-replaybus",
          DetailType: originalEvent["detail-type"],
          Resources: originalEvent.resources,
        },
      ],
    })
    .promise();
};
