import os
import sys
import boto3
import json
from urllib.parse import urlparse
import gzip
from io import BytesIO

def select_gzip(s3_client, bucket, key):
    response = s3_client.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression="SELECT * FROM s3object s WHERE s._5 = '|app.DAGAppMaster|:'",
        InputSerialization = {'CSV': {"FileHeaderInfo": "NONE", "FieldDelimiter": " "}, 'CompressionType': 'GZIP'},
        OutputSerialization = {'CSV': {"RecordDelimiter": "\n"}}
    )
    entries = []
    for event in response['Payload']:
        if 'Records' in event:
            entries.append(event['Records']['Payload'].decode('utf-8'))
    return "\n".join(entries)

def index_handler(event, context):
    print(event)
    s3bucket = os.environ['s3bucket']
    object_get_context = event['getObjectContext']
    request_route = object_get_context['outputRoute']
    request_token = object_get_context['outputToken']
    s3_url = object_get_context['inputS3Url']
    parsed = urlparse(s3_url)
    s3_client = boto3.client('s3')
    # Get Bucket Name, Key from Object URL
    bucket = parsed.hostname.split('.')[0]
    key = parsed.path[1:]
    payload = select_gzip(s3_client, s3bucket, key)
    print(payload)

    # write back to object lambda
    s3_client.write_get_object_response(
        Body=payload,
        RequestRoute=request_route,
        RequestToken=request_token
    )
    return {
        'status_code': 200
    }

