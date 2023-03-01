import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface Ec2instStackProps extends cdk.StackProps {
    vpc: ec2.Vpc,
    securityGroup: ec2.SecurityGroup
}

export class Ec2instStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: Ec2instStackProps) {
        super(scope, id, props);

        const account = cdk.Stack.of(this).account;
        const region = cdk.Stack.of(this).region;

        // IAM Role for Instance Profile
        const instRole = new iam.Role(this, 'inst-role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'Role for ec2 instance',
            roleName: 'inst-role'
        });
        instRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
        instRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));

        // EventBridge policy
        const eventPolicy = new iam.Policy(this, 'event-policy', {
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        'events:PutEvents'
                    ],
                    effect: iam.Effect.ALLOW,
                    resources: [
                        `arn:aws:events:${region}:${account}:event-bus/*`
                    ]
                })
            ]
        });
        instRole.attachInlinePolicy(eventPolicy);

        const sourceBucket = s3.Bucket.fromBucketName(this, 'source-bucket', 'rd-bucket1');
        // UserData
        // download boto3 script from s3
        const sampleUserData = ec2.UserData.forLinux();
        sampleUserData.addCommands(
            'echo \"aws s3 cp s3://aws-logs-466323227181-ap-southeast-1/elasticmapreduce/j-1INSYMF0X6SXB/containers/application_1671110717448_0001/container_1671110717448_0001_01_000001 s3://rd-bucket1/elasticmapreduce/ --recursive\" > /tmp/action.txt'
        );
        const localPath = sampleUserData.addS3DownloadCommand({
            bucket: sourceBucket,
            bucketKey: 'custom-event.py'            
        });

        // TODO: Need to install python3, boto3 using CloudFormationInit

        // Instance
        const ec2Inst = new ec2.Instance(this, 'instance-1', {
            instanceName: 'instance-1',
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            machineImage: ec2.MachineImage.latestAmazonLinux(),
            role: instRole,
            vpc: props.vpc,
            vpcSubnets: {
                subnets: props.vpc.privateSubnets
            },
            securityGroup: props.securityGroup,
            userData: sampleUserData
        });

        // Outputs
        const localAsset = new cdk.CfnOutput(this, 'local-asset', {
            description: 'local asset location',
            value: localPath
        });
    }
}
