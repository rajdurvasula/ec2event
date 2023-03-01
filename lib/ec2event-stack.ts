import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as fs from 'fs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as olambda from 'aws-cdk-lib/aws-s3objectlambda';
import * as event from 'aws-cdk-lib/aws-events';
import * as eventtargets from 'aws-cdk-lib/aws-events-targets';

export interface Ec2EventStackProps extends cdk.StackProps {
  vpc: ec2.Vpc
}

export class Ec2EventStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ec2EventStackProps) {
    super(scope, id, props);

    const account = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // context variables
    const eventBucket = cdk.Stack.of(this).node.tryGetContext('event_bucket');
    const s3APName = cdk.Stack.of(this).node.tryGetContext('s3_ap_name');

    const automationPrincipal = new iam.ServicePrincipal('lambda.amazonaws.com');
    automationPrincipal.withConditions({
      'StringLike': {
        'aws:SourceAccount': account
      },
      'ArnLike': {
        'aws:SourceArn': `arn:aws:ssm:*:${account}:automation-execution/*`
      }
    });

    // iam role for event receiver lambda function
    const eventLambdaRole = new iam.Role(this, 'event-recvr-lambda', {
      assumedBy: automationPrincipal,
      description: 'IAM Role for lambda',
      roleName: 'event-recvr-lambda'
    });
    eventLambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));

    const cwLogPolicy = new iam.Policy(this, 'cw-log-policy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream'
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:logs:${region}:${account}:log-group:*`
          ]
        }),
        new iam.PolicyStatement({
          actions: [
            'logs:PutLogEvents'
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `arn:aws:logs:${region}:${account}:log-group:*:log-stream:*`
          ]
        })
      ]
    });
    eventLambdaRole.attachInlinePolicy(cwLogPolicy);

    // lambda to delete bucket notification
    const deleteS3Notification = new lambda.Function(this, 'delete-s3-notif', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda/notification-handlers/delete')),
      description: 'Lambda to delete bucket event notification',
      functionName: 'delete-s3-notif',
      handler: 'delete-s3-notification.index_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: eventLambdaRole,
      environment: {
        's3bucket': eventBucket
      }
    });

    // IAM role for event bridge rule
    const eventBridgeRole = new iam.Role(this, 'event-bridge-role', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      description: 'Role to allow eventbridge to access other services',
      roleName: 'event-bridge-role'
    });

    // event bridge rule - terminate ec2 instance
    const ec2InstanceTerminateRule = new event.Rule(this, 'ec2-inst-terminate-rule', {
      description: 'Rule for EC2 Instance Terminate State',
      eventPattern: {
        source: ["aws.ec2"],
        detail: {
          "state": ["terminated"]
        },
        detailType: ["EC2 Instance State-change Notification"]
      }
    });
    ec2InstanceTerminateRule.addTarget(new eventtargets.LambdaFunction(deleteS3Notification));

    // Delegate bucket access control to AP
    const bucket = s3.Bucket.fromBucketName(this, 'event-bucket-ref', eventBucket);
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [ '*' ],
      effect: iam.Effect.ALLOW,
      conditions: {
        'StringEquals': {
          's3:DataAccessPointAccount': account
        }
      },
      principals: [ new iam.AnyPrincipal() ],
      resources: [
        bucket.bucketArn,
        bucket.arnForObjects('*')
      ]
    }));

    // IAM Role for object lambda
    const eventFilterFuncRole = new iam.Role(this, 'event-filter-func-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for event-filter-func',
      roleName: 'event-filter-func-role'
    });
    eventFilterFuncRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonS3ObjectLambdaExecutionRolePolicy'))
    eventFilterFuncRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));

    // object lambda to filter log objects from s3
    const eventFilterFunc = new lambda.Function(this, 'event-filter-func', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda/filters')),
      description: 'Object Lambda function to filter log files from s3',
      functionName: 'event-filter-func',
      handler: 'event-filter.index_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: eventFilterFuncRole,
      environment: {
        's3bucket': eventBucket
      }
    });

    // Restrict object lambda permission to own account
    eventFilterFunc.addPermission('ownAccountRestriction', {
      action: 'lambda:InvokeFunction',
      principal: new iam.AccountRootPrincipal(),
      sourceAccount: account
    });

    // Associate bucket's AP with object lambda get access
    const bucketAPAssocPolicyDoc = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'allowLambdaUseAP',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject'
          ],
          principals: [
            new iam.ArnPrincipal(eventFilterFuncRole.roleArn)
          ],
          resources: [ `arn:aws:s3:${region}:${account}:accesspoint/${s3APName}/object/*` ]
        })
      ]
    });

    // s3 access point
    const s3AP = new s3.CfnAccessPoint(this, 'event-ap', {
      bucket: eventBucket,
      name: s3APName,
      vpcConfiguration: {
        vpcId: props.vpc.vpcId
      },
      policy: bucketAPAssocPolicyDoc
    });

    // s3 object lambda access point
    const s3OLAP = new olambda.CfnAccessPoint(this, 'event-olap', {
      objectLambdaConfiguration: {
        supportingAccessPoint: s3AP.attrArn,
        allowedFeatures: [
          'GetObject-Range',
          'GetObject-PartNumber',
          'HeadObject-Range',
          'HeadObject-PartNumber'
        ],
        transformationConfigurations: [
          {
            actions: [
              'GetObject',
              'ListObjects',
              'ListObjectsV2',
              'HeadObject'
            ],
            contentTransformation: {
              'AwsLambda': {
                'FunctionArn': `${eventFilterFunc.functionArn}`
              }
            }
          }
        ]
      }
    });

    // iam role for lambda which receives s3 events
    const s3EventReceiverRole = new iam.Role(this, 's3-event-receiver-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for s3 event receiver lambda',
      roleName: 's3-event-receiver'
    });
    s3EventReceiverRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    s3EventReceiverRole.attachInlinePolicy(cwLogPolicy);
    // policies for lambda vpc
    s3EventReceiverRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'));
    // lambda permission for s3EventReceiver to invoke eventFilterFunc
    const invokeEventFilterFuncPolicy = new iam.Policy(this, 'invoke-event-filter-func', {
      document: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: [ 'lambda:InvokeFunction' ],
            effect: iam.Effect.ALLOW,
            resources: [ eventFilterFunc.functionArn ]
          })
        ]
      }),
      policyName: 'invoke-event-filter-func'
    });
    s3EventReceiverRole.attachInlinePolicy(invokeEventFilterFuncPolicy);

    // lambda to receive s3 event
    const s3EventReceiver = new lambda.Function(this, 's3-event-receiver', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda/loki-agents')),
      description: 'Lambda to receive s3 event',
      functionName: 's3-event-receiver',
      handler: 'promtail-mock.index_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: s3EventReceiverRole,
      vpc: props.vpc,
      vpcSubnets: {
        subnets: props.vpc.privateSubnets
      },
      environment: {
        'event_olap': s3OLAP.attrArn
      }
    });

    // lambda permission to receive s3 event    
    const lambdaPermission = new lambda.CfnPermission(this, 's3-invoke-permission', {
      principal: 's3.amazonaws.com',
      action: 'lambda:InvokeFunction',
      functionName: s3EventReceiver.functionName,
      sourceAccount: account.toString(),
      sourceArn: `arn:aws:s3:::${eventBucket}`
    });

    // lambda to create bucket notification
    const createS3Notification = new lambda.Function(this, 'create-s3-notif', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda/notification-handlers/create')),
      description: 'Lambda to create bucket event notification',
      functionName: 'create-s3-notif',
      handler: 'create-s3-notification.index_handler',
      runtime: lambda.Runtime.PYTHON_3_9,
      role: eventLambdaRole,
      environment: {
        's3_bucket': eventBucket,
        'lambda_arn': s3EventReceiver.functionArn
      }
    });
    createS3Notification.node.addDependency(s3EventReceiver);

    // event bridge rule - create ec2 instance
    // mocking an emr cluster create
    const ec2InstanceCreateRule = new event.Rule(this, 'ec2-inst-create-rule', {
      description: 'Rule for EC2 Instance Creation State',
      eventPattern: {
        source: ["aws.ec2"],
        detail: {
          "state": ["running"]
        },
        detailType: ["EC2 Instance State-change Notification"]
      }
    });
    ec2InstanceCreateRule.addTarget(new eventtargets.LambdaFunction(createS3Notification));

  }
}
