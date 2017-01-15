#!/usr/bin/python

import sqlite3
import sys
import json
import codecs
import itertools

taskDescPath = sys.argv[1]
sqlitePath = sys.argv[2]
tweetPath = sys.argv[3]

taskDesc = {}
with codecs.open(taskDescPath, "r", "utf8") as inFile:
	taskDesc = json.load(inFile)

print taskDesc

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

	return (tweetText, tweetId)

with codecs.open(tweetPath, "r", "utf8") as inFile:
	for line in inFile:
		tweet = json.loads(line)

		(tweetText, tweetId) = readTweet(tweet)

		if ( tweetText == None ):
			print "Skipping:", line
			continue

		tweetList.append((tweetText, tweetId))


# Open the sqlite3 file
conn = sqlite3.connect(sqlitePath)
c = conn.cursor()

c.execute("INSERT INTO tasks (taskName, question) VALUES (:name,:question)", 
	taskDesc)
taskId = c.lastrowid
print "Task ID:", taskId

elementList = map(lambda x: (taskId, x[0], x[1]), tweetList)
elementIds = []
for elTup in elementList:
	c.execute('INSERT INTO elements (taskId, elementText, externalId) VALUES (?,?,?)', 
		elTup)
	elId = c.lastrowid
	elementIds.append(elId)

print "Element Count:", len(elementIds)

# Create the pairs
pairList = [(taskId, x[0], x[1]) for x in itertools.combinations(elementIds, 2)]
print "Pair Count:", len(pairList)

c.executemany('INSERT INTO pairs (taskId, leftElement, rightElement) VALUES (?,?,?)', 
	pairList)

conn.commit()
conn.close()