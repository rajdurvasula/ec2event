import os
import sys
import boto3
import json
import urllib
import gzip
from io import BytesIO
import argparse


parser = argparse.ArgumentParser()
parser.add_argument('account', help='AWS account id')
parser.add_argument('accesspoint', help='S3 access point name')
parser.add_argument('key', help='S3 key')

session = boto3.Session()

def read_gzip(s3_client, bucket, key):
    response = s3_client.get_object(Bucket=bucket, Key=key)
    gzipfile = BytesIO(response['Body'].read())
    gzipfile = gzip.GzipFile(fileobj=gzipfile)
    content = gzipfile.read().decode('utf-8')
    print(content)

def read_content(s3_client, bucket, key):
    response = s3_client.get_object(Bucket=bucket, Key=key)
    content = response['Body'].read().decode('utf-8')
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
    for event in response['Payload']:
        if 'Records' in event:
            records = event['Records']['Payload'].decode('utf-8')
            print(records)

def main():
    args = parser.parse_args()
    s3_client = session.client('s3')
    s3control_client = session.client('s3control')
    paginator = s3control_client.get_paginator('list_access_points_for_object_lambda')
    iterator = paginator.paginate(AccountId=args.account)
    for page in iterator:
        for olap in page['ObjectLambdaAccessPointList']:
            if args.accesspoint in olap['Name']:
                print('Found matching Object Lambda AP: %s' % olap['ObjectLambdaAccessPointArn'])
                read_content(s3_client, olap['ObjectLambdaAccessPointArn'], args.key)

if __name__ == '__main__':
    main()