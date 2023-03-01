#!/bin/bash -x
cdk deploy EventVpcStack --require-approval=never
read -p "Press enter to continue"
cdk deploy Ec2EventStack --require-approval=never
read -p "Press enter to continue"
cdk deploy Ec2InstStack --require-approval=never
