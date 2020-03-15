# evb-cli
Pattern generator for CloudWatch Events / EventBridge

## Installation 
Unless using AWS Single Sign-On, make sure you have your `AWS_REGION` environment variable set. Alternatively set `AWS_SDK_LOAD_CONFIG` to a truthy value.

`npm install -g @mhlabs/evb-cli`

## Usage
`evb pattern` - Will prompt you with a wizard that helps you build pattern for event matching. This is using EventBridge's schema registry (currently in preview) to let you navigate the schema you want to react on. 

`evb pattern --format <yaml|json>` - Output format. Default is `json`

For AWS events, such as `aws.codepipeline` it's already enabled, but for custom events you will have to enable it in the AWS Management Console.

![Demo](demo.gif)

## AWS SSO authentication

To set up [AWS Single Sign-On](https://aws.amazon.com/single-sign-on/) auth you'll need to configure the following parameters:

```
evb configure-sso --account-id 123456789012 --start-url https://<your-sso-url>.awsapps.com/start --region <your-region> --role <your-sso-role>
```

The role used should be allowed to perform `schemas:ListSchemas` and `schemas:DescribeSchemas`