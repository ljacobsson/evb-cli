# evb-cli
Pattern generator for CloudWatch Events / EventBridge

## Installation 
Unless using AWS Single Sign-On, make sure you have your `AWS_REGION` environment variable set. Alternatively set `AWS_SDK_LOAD_CONFIG` to a truthy value.

`npm install -g @mhlabs/evb-cli`

## Usage

### To generate an EventBridge pattern:
`evb pattern` - Will prompt you with a wizard that helps you build pattern for event matching. This is using EventBridge's schema registry (currently in preview) to let you navigate the schema you want to react on. 

`evb pattern --format <yaml|json>` - Output format. Default is `json`

For AWS events, such as `aws.codepipeline` it's already enabled, but for custom events you will have to enable it in the AWS Management Console.

![Demo](demo.gif)

### To generate an EventBridge InputTransformer object:
[Input transformers](https://docs.aws.amazon.com/eventbridge/latest/userguide/eventbridge-input-transformer-tutorial.html) are useful when you only want a small portion of the event sent to your target. This command helps you navigate the JSON payload and generate the [InputTransformer CloudFormation object](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-events-rule-inputtransformer.html)

`evb input` will prompt you with a wizard that helps you build the InputTransformer object. This is using EventBridge's schema registry (currently in preview).

`evb input --format <yaml|json>` - Output format. Default is `json`

![Demo](demo-input.gif)

### To browse targets of events:
Select a schema from the schema registry and list its targets. Select a target to browse details such as ARN, event pattern, input transformation, etc.

`evb browse` will let you browse your schemas and get insights into the targets listening to the source/detail-type combination of your event. This only works with explicit maching on `source` and `detail-type`.

![Demo](demo-browse.gif)

### To generate an interactive graph over the event rules of an eventbus
```
Usage: evb graph|g [options]

Builds an interactive graph over an eventbus' rules 

Options:
  -b, --eventbus [eventbus]  Eventbus to create graph for (default: "default")
  -p, --profile [profile]    AWS profile to use
  -h, --help                 output usage information
```
![Demo](demo-graph.gif)

This is an experimental feature. Grouping by tag is possible for the following target types: Lambda, StepFunctions, SNS, SQS, Kinesis. More will follow.
