import os
import sys
from urllib.parse import urlparse

object_url = "https://rd-bucket1.s3.ap-southeast-1.amazonaws.com/elasticmapreduce/syslog.gz"

def main():
    parsed = urlparse(object_url)
    print('Host: %s' % parsed.hostname)
    bucket_name = parsed.hostname.split('.')[0]
    print('Bucket Name = %s' % bucket_name)
    print('Key = %s' % parsed.path[1:])

if __name__ == '__main__':
    main()