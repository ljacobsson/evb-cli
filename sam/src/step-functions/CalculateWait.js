exports.handler = async function (event, context) {
  console.log(event);
  const eventTime = Date.parse(event.OriginalEvent.time);
  const startTime = Date.parse(event.StartTime);
  const speed = event.ReplaySpeed / 100;
  console.log(eventTime, startTime, speed);
  const waitSeconds = Math.round((speed * (eventTime - startTime)) / 1000);

  event.waitSeconds = waitSeconds;
  return event;
};
