![Node.js CI](https://github.com/mhlabs/evb-cli/workflows/Node.js%20CI/badge.svg)

# evb-cli
Pattern generator and debugging tool for EventBridge

## Installation
`npm install -g @mhlabs/evb-cli`

## Usage

### To generate an EventBridge pattern:
`evb pattern` - Will prompt you with a wizard that helps you build pattern for event matching. This is using EventBridge's schema registry (currently in preview) to let you navigate the schema you want to react on. 

`evb pattern --format <yaml|json>` - Output format. Default is `json`

For AWS events, such as `aws.codepipeline` it's already enabled, but for custom events you will have to enable it in the AWS Management Console.

![Demo](https://github.com/mhlabs/evb-cli/raw/master/images/demo.gif)

### To generate an EventBridge InputTransformer object:
[Input transformers](https://docs.aws.amazon.com/eventbridge/latest/userguide/eventbridge-input-transformer-tutorial.html) are useful when you only want a small portion of the event sent to your target. This command helps you navigate the JSON payload and generate the [InputTransformer CloudFormation object](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-events-rule-inputtransformer.html)

`evb input` will prompt you with a wizard that helps you build the InputTransformer object. This is using EventBridge's schema registry (currently in preview).

`evb input --format <yaml|json>` - Output format. Default is `json`

![Demo](https://github.com/mhlabs/evb-cli/raw/master/images/demo-input.gif)

### To browse targets of events:
Select a schema from the schema registry and list its targets. Select a target to browse details such as ARN, event pattern, input transformation, etc.

`evb browse` will let you browse your schemas and get insights into the targets listening to the source/detail-type combination of your event. This only works with explicit matching on `source` and `detail-type`.

![Demo](https://github.com/mhlabs/evb-cli/raw/master/images/demo-browse.gif)

### To generate an interactive diagram over the event rules of an eventbus
```
Usage: evb diagram|d [options]

Builds an interactive diagram over an eventbus' rules 

Options:
  -b, --eventbus [eventbus]  Eventbus to create diagram for (default: "default")
  -p, --profile [profile]    AWS profile to use
  -h, --help                 output usage information
```
![Demo](https://github.com/mhlabs/evb-cli/raw/master/images/demo-diagram.gif)

This is an experimental feature. Grouping by tag is possible for the following target types: Lambda, StepFunctions, SNS, SQS, Kinesis. More will follow.

### Extract `AWS::Serverless::Function` Event to `AWS::Events::Rule`
Sometimes you start off with a simple [EventBridgeRule](https://github.com/aws/serverless-application-model/blob/master/versions/2016-10-31.md#eventbridgerule) transform on you `AWS::Serverless::Function` resource. Later on you might want to evolve it and start using an [InputTransformer](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-events-rule-inputtransformer.html) or retry/DLQ configurations which is only supported by `AWS::Events::Rule`

Use `evb extract-sam-event` to unfold the SAM event to full CloudFormation syntax.

### Test event payload against all rules on a bus
```
Usage: evb test-event|t [options]

Tests an event payload against existing rules on a bus

Options:
  -e, --event-input-file [event-file]  Path to test event (default: "event.json")
  -n, --name-prefix [name-prefix]      Name prefix for rules; helpful to narrow against one or a few rules only
  -b, --eventbus [eventbus]            The eventbus to test against (default: "default")
  -a, --all                            Show all rules, even unmatched ones (default: false)
```
Example event input can be found [here](tests/test-event.json) 

## Replay events
```
Usage: evb replay|r [options]

Starts a replay of events against a specific destination

Options:
  -b, --eventbus [eventbus]       The eventbus the archive is stored against (default: "default")
  -r, --rule-prefix [rulePrefix]  Rule name prefix
  -p, --profile [profile]         AWS profile to use
  -s, --replay-speed [speed]      The speed of the replay in % where 0 == all at once and 100 == real time speed
  -n, --replay-name [name]        The replay name (default: "evb-cli-replay-1605913422337")
  --region [region]               The AWS region to use. Falls back on AWS_REGION environment variable if not specified
  -h, --help                      output usage information
```

### Paced replays
** Requires [evb local](#local-debugging) >= v0.0.7 **

Evb-cli provides support for paced replay delivery where you can pass a replay speed scalar between 0 and 100 where 0 is as fast as possible (native EventBridge way) and 100 is real time speed where a one hour replay takes one hour. Passing `--replay-speed 10` to a one hour replay will scale the replay speed to 6 minutes, but will still retain the same order and a scaled delay between messages.

Currently EventBridge will run your replay at the fastest possible speed. Due to the unordered nature of EventBridge, this means there's an increased likelyhood that your events will be delivered more randomly during a replay than when live.

Your EventBridge targets should always be idempotent, but for debugging purposes you might want the likely order of the events. 

For example, you might replay 5 hours of `order` events and want to expect each order to transition from `OPEN` to `CONFIRMED` to `DELIVERED` in the logical order. If you run a default replay it's likely that these events will be delivered in the wrong order.

### Pricing
When using `--replay-speed` > 0, each event in the replay will be sent through a Step Functions state machine of 5 state transitions. See [Step Functions pricing](https://aws.amazon.com/step-functions/pricing/) for you region.

### Caveats
* At delivery, the `replay-name` field will be stripped. 
* Step Functions is used to pace the replay. EventBridge will consider the replay a success as long as the events were delivered to Step Functions.

## Local debugging
Local debugging makes use to API Gateway V2 websockets to forward actual events in the cloud to your developer machine. The requires a [Serverless Application Repository app](https://serverlessrepo.aws.amazon.com/applications/eu-west-1/751354400372/evb-local) to be installed in your account. Note that depending on your traffic, there will be some small effect on your billing in the form of Lambda invocations, API Gateway invocations, CloudWatch Logs and DynamoDB R/W.

![Demo](images/demo-local.gif)

Example of testing a rule before deploying the stack. The user quickly gets feedback on their patterns and input transforms. In this example we're listening to all aws.* events and transforming the output to 
```
{
  "source": <source>,
  "time": <time>
}
```
The user then decided to add `detail-type` to the transform:
```
{
  "source": <source>,
  "detail-type": <detail-type>,
  "time": <time>
}
```


There are three methods of consuming events covering three use cases:
### Listen to all deployed rules in a given stack
*Command*: `evb local --stack-name <stack-name>`
*Use case*: You have a deployed stack and want to analyse the events matching any rule in the stack. Useful if you want to real-time monitor actual behaviour of the application.

### Test a rule before deploying the stack
*Command*: `evb local --rule <rule logical id (optional)>`
*Use cases*: 
* You want to test a pattern or input transformation without deploying the entire stack. This speeds up trial and error resolutions. 
* You want to analyse traffic for a given pattern over time
If the rule's logical ID is omitted such as `evb local --rule` the tool will parse the template and let you navigate and choose the rule

### Test a given ARN on a deployed stack
*Command*: `evb local --arn <rule-arn>`
*Use cases*: 
* You want to test the behaviour of an already deployed rule where you don't know the stack's name or where it doesn't belong to a stack.

## Replaying archived events
Add `--replay` option to command. This will guide you through a wizard to find the archive and set the time range to replay.

Note that this currently only works together with the `-t` flag and it requires at least v0.0.6 of the [evb-local backend](https://serverlessrepo.aws.amazon.com/applications/eu-west-1/751354400372/evb-local)

## Forward events to sam-local
All `evb local` commands support a `--sam-local` flag. When used, events will be passed on to sam-local for more advanced debugging
