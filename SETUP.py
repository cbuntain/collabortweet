'''This script runs some basic setup steps for collabortweet
Author: Fridolin Linder

Usage:
$> python setup.py
'''
import subprocess
import json
import sys

with open('CONFIG.json') as infile:
    config = json.load(infile)

# Install dependencies
subprocess.call('npm install', shell=True)

# Set up the database
subprocess.call(
    'sqlite3 {} < createSchema.sql'.format(config['db_path']),
    shell=True
)

# Print out info
print('\n\n')
print('+'*80)
print('You can now start the collabortweet application with the command `npm start`')
print('Your application will be available at http://178.128.157.54:{}'.format(config['port']))
print('+'*80)
print('\n\n')

