import os
import sys
import boto3
import json
import urllib
import gzip
from io import BytesIO
import argparse


parser = argparse.ArgumentParser()
parser.add_argument('bucket', help='S3 bucket name')
parser.add_argument('key', help='S3 object key')

session = boto3.Session()

def read_gzip(s3_client, bucket, key):
    response = s3_client.get_object(Bucket=bucket, Key=key)
    gzipfile = BytesIO(response['Body'].read())
    gzipfile = gzip.GzipFile(fileobj=gzipfile)
    content = gzipfile.read().decode('utf-8')
    print(content)

def select_gzip(s3_client, bucket, key):
    response = s3_client.select_object_content(
        Bucket=bucket,
        Key=key,
        ExpressionType='SQL',
        Expression="SELECT * FROM s3object s WHERE s._5 = '|app.DAGAppMaster|:'",
        InputSerialization = {'CSV': {"FileHeaderInfo": "NONE", "FieldDelimiter": " "}, 'CompressionType': 'GZIP'},
        OutputSerialization = {'CSV': {}}
    )
    entries = []
    for event in response['Payload']:
        if 'Records' in event:
            entries.append(event['Records']['Payload'].decode('utf-8'))
    return entries

def main():
    args = parser.parse_args()
    s3_client = session.client('s3')
    entries = select_gzip(s3_client, args.bucket, args.key)
    for entry in entries:
        print(entry)

if __name__ == '__main__':
    main()