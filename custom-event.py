import os
import sys
import boto3
import json
from datetime import datetime

session = boto3.Session()

def put_custom_event(event_client):
    detail = {
        'state': 'instance-actioned',
        's3bucket': 'rd-bucket1'
    }
    event_client.put_events(
        Entries=[
            {
                'Time': datetime.now(),
                'Detail': json.dumps(detail),
                'DetailType': 'EC2 Instance Action'
            }
        ]
    )

def main():
    event_client = session.client('events')
    put_custom_event(event_client)

if __name__ == '__main__':
    main()