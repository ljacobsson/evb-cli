const AWS = require("aws-sdk");
const eventbridge = new AWS.EventBridge();

exports.handler = async function (event, context) {
  const originalEvent = event.OriginalEvent;
  originalEvent.source = event.DispatchSource;
  console.log(event);
  const entry = {
    Detail: JSON.stringify(originalEvent.detail),
    Source: event.DispatchSource,
    Time: originalEvent.time,
    EventBusName: event.EventBusName,
    DetailType: originalEvent["detail-type"],
    Resources: [
      ...originalEvent.resources,
      `arn:aws:events:${process.env.AWS_REGION}:${process.env.AccountId}:archive/${event.ReplayName}`,
    ],
  };

  console.log(entry);
  await eventbridge
    .putEvents({
      Entries: [
        entry
      ],
    })
    .promise();
};
