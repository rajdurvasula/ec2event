import os
import sys
import boto3
import json
import urllib
#import gzip
#from io import BytesIO

def index_handler(event, context):
    # event delivers EMR cluster id
    # Using EMR API get EMR Log URI = S3 bucket
    bucket = os.environ['event_olap']
    key = ''
    if 'Records' in event:
        # USE OLAP ARN
        #bucket = event['Records'][0]['s3']['bucket']['name']
        # Get the Object that was PUT, POST, COPY
        key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
        s3_client = boto3.client('s3')
        if bucket != '' and key != '':
            response = s3_client.get_object(Bucket=bucket, Key=key)
            # get gzip content
            #print("CONTENT TYPE: " + response['ContentType'])
            #gzipfile = BytesIO(response['Body'].read())
            #gzipfile = gzip.GzipFile(fileobj=gzipfile)
            #content = gzipfile.read().decode('utf-8')

            # plain text
            content = response['Body'].read().decode('utf-8')
            print(content)
        else:
            print('Object not found')
