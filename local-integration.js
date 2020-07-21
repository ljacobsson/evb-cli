const AWS = require("aws-sdk");
const iam = new AWS.IAM();
const lambda = new AWS.Lambda();

async function createLocalConsumer(target) {
  console.log(targetIntegration);
  const role = iam.createRole({
      
  });
  await lambda
    .createFunction({
      FunctionName: `local-${target.pattern.source[0]}-${target.pattern["detail-type"][0]}`,
      Runtime: "nodejs12.x"
    })
    .promise();
}

module.exports = {
  createLocalConsumer
};
