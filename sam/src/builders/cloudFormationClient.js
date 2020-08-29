const AWS = require("aws-sdk");
const cloudFormation = new AWS.CloudFormation();

async function getEventConsumerName() {
  const evbLocalStack = await cloudFormation
    .listStackResources({ StackName: process.env.StackName })
    .promise();
  const eventConsumerName = evbLocalStack.StackResourceSummaries.filter(
    (p) => p.LogicalResourceId === "EventConsumer"
  )[0].PhysicalResourceId;
  return eventConsumerName;
}

async function getStackResources(stackName) {
  const stackResourcesResponse = await cloudFormation
    .listStackResources({ StackName: stackName })
    .promise();
  let nextToken = stackResourcesResponse.NextToken;
  while (nextToken) {
    const more = await cloudFormation
      .listStackResources({ StackName: stackName, NextToken: nextToken })
      .promise();
    stackResourcesResponse.StackResourceSummaries.push(
      ...more.StackResourceSummaries
    );
    nextToken = more.NextToken;
  }
  return stackResourcesResponse;
}

module.exports = {
  getEventConsumerName,
  getStackResources,
};
