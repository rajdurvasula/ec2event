import os
import sys
import boto3
import json

session = boto3.Session()

def delete_bucket_policy(s3_client, s3_bucket):
    s3_client.delete_bucket_policy(
        Bucket=s3_bucket
    )

def index_handler(event, context):
    s3_bucket = os.environ['s3_bucket']
    s3_client = session.client('s3')
    delete_bucket_policy(s3_client, s3_bucket)
