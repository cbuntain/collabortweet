#!/usr/bin/python

import sqlite3
import sys
import json
import html
import codecs
import itertools
import random
import requests

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

# Use Twitter's embed API endpoint to get the HTML for a tweet
def getEmbed(username, tweetId, default="<pre></pre>"):
	payload = {
		"url": html.escape("https://twitter.com/%s/status/%d" % (username, tweetId))
	}
	req = requests.get('https://publish.twitter.com/oembed', params=payload)

	renderedHtml = default
	
	# Try to get the HTML from Twitter's oEmbed API. 
	#. we check if we get 200 Status OK code and if the "HTML" key is 
	#. in the response before extracting it. Deleted tweets return 404,
	#. and some tweets return 403, which I assume means tweet is 
	#. protected.
	try:
		if ( req.status_code == 200 ):
			resp = req.json()
			if ( "html" in resp ):
				renderedHtml = resp["html"] # replace default HTML 
		else:
			print("Wrong Code:", req.status_code)
	except json.decoder.JSONDecodeError as jde:
		print("Error on getting tweet:", tweetId)
		print("Response Code:", req.status_code)
		print("Response:", req.text)
	
	return renderedHtml

# Get the contents of this tweet
def readTweet(tweetObj):
	tweetText = None
	tweetId = None
	tweetUser = None

	if ( "text" in tweetObj ): # Twitter format
		tweetText = "%s - %s" % (tweetObj["user"]["screen_name"], tweetObj["text"])
		tweetId = tweetObj["id"]
		tweetUser = tweetObj["user"]["screen_name"]
	elif ( "body" in tweetObj ): # Gnip Format
		tweetText = "%s - %s" % (tweetObj["actor"]["preferredUsername"], tweetObj["body"])
		idstr = tweetObj["id"]
		tweetId = int(idstr[idstr.rfind(":")+1:])
		tweetUser = tweetObj["actor"]["preferredUsername"]

	defaultHtmlText = "<pre>" + html.escape(tweetText) + "</pre>"
	renderedHtml = getEmbed(tweetUser, tweetId, defaultHtmlText)

	return (renderedHtml, tweetId)

with codecs.open(tweetPath, "r", "utf8") as inFile:
	for line in inFile:
		tweet = json.loads(line)

		(tweetText, tweetId) = readTweet(tweet)

		if ( tweetText == None ):
			print("Skipping:", line)
			continue

		tweetList.append((tweetText, tweetId))


# Open the sqlite3 file
conn = sqlite3.connect(sqlitePath)
c = conn.cursor()

c.execute("INSERT INTO tasks (taskName, question, taskType) VALUES (:name,:question,:type)", 
	taskDesc)
taskId = c.lastrowid
print("Task ID:", taskId)

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
	labelList = [{"taskId": taskId, "labelText": x} for x in taskDesc["labels"]]
	print (labelList)
	
	c.executemany('INSERT INTO labels (taskId, labelText) VALUES (:taskId,:labelText)', 
		labelList)

# Otherwise, we have an invalid task type
else:
	print ("ERROR! Task type [" + taskDesc["type"] + "] is not valid!")

conn.commit()
conn.close()