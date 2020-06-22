#!/usr/bin/python

import sqlite3
import sys
import json
import html
import codecs
import itertools
import random

from utils import insert_labels
from utils import insert_ranges

taskDescPath = sys.argv[1]
sqlitePath = sys.argv[2]
tweetPath = sys.argv[3]

pairCount = None
if ( len(sys.argv) > 4 ):
	pairCount = int(sys.argv[4])

taskDesc = {}
with codecs.open(taskDescPath, "r", "utf8") as inFile:
	taskDesc = json.load(inFile)

print(taskDesc)

tweetList = []

# Get the contents of this tweet
def readTweet(tweetObj):
	tweetText = None
	tweetId = None

	if ( "text" in tweetObj ): # Twitter format
		tweetText = "%s - %s" % (tweetObj["user"]["screen_name"], tweetObj["text"])
		tweetId = tweetObj["id"]
	elif ( "body" in tweetObj ): # Gnip Format
		tweetText = "%s - %s" % (tweetObj["actor"]["preferredUsername"], tweetObj["body"])
		idstr = tweetObj["id"]
		tweetId = idstr[idstr.rfind(":")+1:]

	htmlText = "<pre>" + html.escape(tweetText) + "</pre>"

	return (tweetText, tweetId)

with codecs.open(tweetPath, "r", "utf8") as inFile:
	for line in inFile:
		tweet = json.loads(line)

		# CB 20200326: Adding this check to remove instances
		#  where we have a retweeted_status and quoted_status
		#  field but they are NONE. This can happen if the data
		#  source of the tweets embed these fields because some
		#  tweets have them. E.g., Pandas does this when you read
		#  in tweets to a DataFrame and then export them to JSON
		if "retweeted_status" in tweet and tweet["retweeted_status"] is None:
			tweet.pop("retweeted_status")
		if "quoted_status" in tweet and tweet["quoted_status"] is None:
			tweet.pop("quoted_status")

		# Now process the tweet as normal
		(tweetText, tweetId) = readTweet(tweet)

		if ( tweetText == None ):
			print("Skipping:", line)
			continue

		tweetList.append((tweetText, tweetId))


# Open the sqlite3 file
conn = sqlite3.connect(sqlitePath)
c = conn.cursor()

if taskDesc["type"] != 3:
        c.execute('INSERT INTO tasks (taskName, question, taskType) VALUES (:name,:question,:type)', 
                taskDesc)
        taskId = c.lastrowid
        print("Task ID:", taskId)
elif taskDesc["type"] == 3:
        rangeDesc = [taskDesc["name"], "Range-Based Question", 3]

        c.execute('INSERT INTO tasks (taskName, question, taskType) VALUES (?,?,?)',
                  rangeDesc)
        taskId = c.lastrowid
        
elementList = [(taskId, x[0], x[1]) for x in tweetList]
elementIds = []
for elTup in elementList:
        c.execute('INSERT INTO elements (taskId, elementText, externalId) VALUES (?,?,?)', 
                elTup)
        elId = c.lastrowid
        elementIds.append(elId)

print( "Element Count:", len(elementIds))
        
        
# Only create pairs if the task type == 1
if ( taskDesc["type"] == 1 ):
	# Create the pairs
	pairList = None

	# If we didn't specify a number of pairs, find all
	if ( pairCount == None ):
		pairList = itertools.combinations(elementIds, 2)

	else: # Otherwise, randomly select k pairs
		pairAccum = set()

		for eIndex in range(len(elementIds)):
			eId = elementIds[eIndex]
			startIndex = max(0, eIndex-1)
			others = elementIds[:startIndex] + elementIds[eIndex+1:]

			# Put the pair in canonical order to avoid duplicates
			newPairs = set(map(lambda x: (min(eId, x), max(eId, x)), 
				random.sample(others, pairCount)))

			pairAccum = pairAccum.union(newPairs)

		pairList = list(pairAccum)

	pairList = [(taskId, x[0], x[1]) for x in pairList]
	print ("Pair Count:", len(pairList))

	c.executemany('INSERT INTO pairs (taskId, leftElement, rightElement) VALUES (?,?,?)', 
		pairList)

# If we are dealing with a labeling task (type == 2), insert the labels
elif ( taskDesc["type"] == 2 ):

	print ("Insert labels...")
	insert_labels(c, taskDesc["labels"], taskId)

# If we are dealing with a range task (type == 3), provide the ranges
elif(taskDesc["type"] == 3):
        print("Insert range questions, scales and values...")
        insert_ranges(c, taskId, taskDesc["name"], taskDesc["questions"])

# If we are dealing with a multiple choice task (type == 4), provide the choices
elif ( taskDesc["type"] == 4 ):

	print ("Insert choices...")
	insert_labels(c, taskDesc["labels"], taskId)


# Otherwise, we have an invalid task type
else:
	print ("ERROR! Task type [" + taskDesc["type"] + "] is not valid!")

conn.commit()
conn.close()
