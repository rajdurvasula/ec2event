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

def delete_s3_notification(s3_client, s3_bucket):
    print('Deleting s3 notification from Bucket: %s' % s3_bucket)
    lambdaNotificationConfig = {}
    s3_client.put_bucket_notification_configuration(
        Bucket=s3_bucket,
        NotificationConfiguration=lambdaNotificationConfig,
        SkipDestinationValidation=False
    )

def index_handler(event, context):
    s3_client = session.client('s3')
    s3_bucket = os.environ['s3_bucket']
    delete_s3_notification(s3_client, s3_bucket)

