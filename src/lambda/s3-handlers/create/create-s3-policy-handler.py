import os
import sys
import boto3
import json

session = boto3.Session()

def create_bucket_policy(account_id, s3_client, s3_bucket, lambda_arn):
    bucket_arn = "arn:aws:s3:::{}".format(s3_bucket)
    lambda_invoke_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "invoke-lambda",
                "Effect": "Allow",
                "Principal": {
                    "Service": "s3.amazonaws.com"
                },
                "Action": "lambda:InvokeFunction",
                "Resource": lambda_arn,
                "Condition": {
                    "AWS:SourceAccount": account_id
                },
                "ArnLike": {
                    "AWS:SourceArn": bucket_arn
                }
            }
        ]
    }
    s3_client.put_bucket_policy(
        Bucket=s3_bucket,
        Policy=json.dumps(lambda_invoke_policy)
    )

def index_handler(event, context):
    account_id = os.environ['account_id']
    lambda_arn = os.environ['lambda_arn']
    s3_bucket = os.environ['s3_bucket']
    s3_client = session.client('s3')
    create_bucket_policy(account_id, s3_client, s3_bucket, lambda_arn)
