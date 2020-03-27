# CollaborTweet

This code is a framework for assessing text documents using a collaborative, online framework. It's written in Node.js and makes heavy use of third-party packages, like Express, Sqlite, etc.

This framework was initially developed to impose an ordering over a textual data set using pairwise comparisons (not unlike [SentimentIt](https://www.sentimentit.com)). The original task was to evaluate emotional intensity of Twitter data by providing users with a pair of tweets and asking them to assess which one exhibits a more negative feeling. This framework can support any such task using textual data and is not restricted to Twitter data, though I suggest short-form text rather than long documents.

In addition, the system has been updated to support labeling text as well. If you want to do a simple relevance classification task on text, this platform will work for you too.

The framework is also designed to support multiple users and multiple tasks, but these settings are only vaguely implemented. The system currently supports a single task, and users are specified by a file (users.js) in the users directory. One or both of these features should be implemented soon.

## Setup

You should be able to use `npm install` to set up the server and download any dependencies. Then, `npm start` will run the server, which you can access (currently) at (http://localhost:3000). 

Before starting the server, you need to set up the database. This can be done using the createSchema.sql file (e.g., `sqlite3 database.sqlite3 < createSchema.sql`). Then, use the `tweets2sql.py` python script to populate the database.

### Creating Tasks

The `tweets2sql.py` script expects three arguments: a JSON file describing the task, the path to the SQLite file you created before, and the path the JSON file containing tweets (either in Twitter's format or Gnip's activity format).

The JSON task description file contains the name of the task, the question you want to ask the user, and the type of task (1 for pairwise comparison, 2 for labeling tasks). For pairwise comparisons, you don't need more information. For the labeling task, you also need to include a list of labels.

Examples are below:

#### Comparison Task Description JSON

	{
		"name": "Nigeria 2014 - Negativity Comparisons",
		"question": "Which of these tweets seems more emotionally negative?",
		"type": 1
	}

#### Labeling Task Description JSON

	{
		"name": "Nigeria 2015 - Relevance Labels",
		"question": "Is this tweet relevant to the Nigerian 2015 election?",
		"type": 2,
		"labels": [
			"Relevant",
			"Not Relevant",
			"Not English",
			"Can't Decide"
		]
	}


### Creating Users

Once your database is populated, you need to add users to the system. Users aren't for authentication so much as ensuring we don't show the same pair to the same user multiple times. Currently, the system uses the __users__ table in the sqlite file, so add users there. Using sqlite, you can do it easily:

	sqlite3 database.sqlite3 'INSERT INTO users (userId, screenname, password, fname, lname) VALUES (1, "cbuntain", "cb123", "Cody", "Buntain")'
