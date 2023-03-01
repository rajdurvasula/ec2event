import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class EventVpcStack extends cdk.Stack {

    public readonly vpc: ec2.Vpc;
    public readonly securityGroup: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const account = cdk.Stack.of(this).account;
        const region = cdk.Stack.of(this).region;

        // context variables
        const vpcCidr = cdk.Stack.of(this).node.tryGetContext('vpc_cidr');
        const s3APName = cdk.Stack.of(this).node.tryGetContext('s3_ap_name');
        const eventBucket = cdk.Stack.of(this).node.tryGetContext('event_bucket');

        this.vpc = new ec2.Vpc(this, 'event-vpc', {
            availabilityZones: cdk.Stack.of(this).availabilityZones.sort().slice(0,2),
            enableDnsHostnames: true,
            enableDnsSupport: true,
            ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
            subnetConfiguration: [
                {
                    cidrMask: 20,
                    name: 'pub',
                    subnetType: ec2.SubnetType.PUBLIC
                },
                {
                    cidrMask: 20,
                    name: 'priv',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
                }
            ]
        });

        // S3 Gateway Endpoint
        const s3GatewayEP = this.vpc.addGatewayEndpoint('s3-gateway-ep', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [
                {
                    subnets: this.vpc.privateSubnets
                }
            ]
        });
        // TODO: non-blocking
        // Need to finetune s3 access in s3 endpoint policy
        /*
        s3GatewayEP.addToPolicy(new iam.PolicyStatement({
            actions: [
              's3:Get*',
              's3:Put*'
            ],
            effect: iam.Effect.ALLOW,
            principals: [
              new iam.AccountPrincipal(account)
            ],
            resources: [
              `arn:aws:s3:::${eventBucket}`,
              `arn:aws:s3:${region}:${account}:accesspoint/${s3APName}/object/*`
            ]
          }));
        */
        
        // CW Logs
        this.vpc.addInterfaceEndpoint('cw-logs', {
            service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
        });
        // SSM
        this.vpc.addInterfaceEndpoint('ssm', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM
        });
        // SSM Messages
        this.vpc.addInterfaceEndpoint('ssm-messages', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES
        });
        // EC2 Messages
        this.vpc.addInterfaceEndpoint('ec2-messages', {
            service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES
        });
        // Lambda
        this.vpc.addInterfaceEndpoint('lambda', {
            service: ec2.InterfaceVpcEndpointAwsService.LAMBDA
        });

        const securityGroup = new ec2.SecurityGroup(this, 'instance-sg', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Instance Security Group',
            securityGroupName: 'instance-sg'
        });
        securityGroup.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow all traffic in VPC');
        securityGroup.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(443), 'Allow HTTPS');

    }
}