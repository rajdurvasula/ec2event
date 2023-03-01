import os
import sys
import json
import boto3
from datetime import date, datetime

session = boto3.Session()

def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError('Type %s not serializable' % type(obj))

def create_s3_notification(s3_client, s3_bucket, lambdaArn, keyFilter):
    print('Creating s3 notification on Bucket: %s, Target: %s' % (s3_bucket, lambdaArn))
    s3_client.put_bucket_notification_configuration(
        Bucket=s3_bucket,
        NotificationConfiguration={
            "LambdaFunctionConfigurations": [
                {
                    "LambdaFunctionArn": lambdaArn,
                    "Events": [
                        "s3:ObjectCreated:*"
                    ]
                }
            ]
        },
        SkipDestinationValidation=False
    )

def index_handler(event, context):
    s3_client = session.client('s3')
    s3_bucket = os.environ['s3_bucket']
    lambdaArn = os.environ['lambda_arn']
    # actual EMR Cluster RUNNING event gets EMR JobFlow ID 'j-xxxxxxxxxx'
    keyFilter = ''
    create_s3_notification(s3_client, s3_bucket, lambdaArn, keyFilter)

