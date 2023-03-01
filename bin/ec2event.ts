#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Ec2EventStack } from '../lib/ec2event-stack';
import { Ec2instStack } from '../lib/ec2inst-stack';
import { EventVpcStack } from '../lib/event-vpc-stack';

const app = new cdk.App();

const eventVpcStack = new EventVpcStack(app, 'EventVpcStack', {
  env: { account: '466323227181', region: 'ap-southeast-1' },
});

new Ec2instStack(app, 'Ec2InstStack', {
  env: { account: '466323227181', region: 'ap-southeast-1' },
  vpc: eventVpcStack.vpc,
  securityGroup: eventVpcStack.securityGroup
});

new Ec2EventStack(app, 'Ec2EventStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },
  env: { account: '466323227181', region: 'ap-southeast-1' },
  vpc: eventVpcStack.vpc

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});