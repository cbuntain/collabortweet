#!/usr/bin/python

import sqlite3
import sys
import json
import html
import codecs
import itertools
import random

sqlitePath = sys.argv[1]
taskId = int(sys.argv[2])

print("Deleting Task [%d] from: %s" % (taskId, sqlitePath))

# Open the sqlite3 file
conn = sqlite3.connect(sqlitePath)
c = conn.cursor()

# Delete all element labels
c.execute("DELETE FROM elementLabels WHERE labelId IN (SELECT l.labelId FROM labels l WHERE l.taskId = :taskId)", 
    {"taskId": taskId})

# Delete all elements
c.execute("DELETE FROM elements WHERE taskId = :taskId", 
    {"taskId": taskId})

# Delete all labels
c.execute("DELETE FROM labels WHERE taskId = :taskId", 
    {"taskId": taskId})

# Delete task
c.execute("DELETE FROM tasks WHERE taskId = :taskId", 
    {"taskId": taskId})

# Commit
conn.commit()
conn.close()

print("Task Deleted.")