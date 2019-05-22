'''
This script imports tweets into an exsisting collabortweet task

If the tweet is
still available on Twitter, the html for the full rendered tweet (as it would
appear on Twitter) is extracted from the Twitter oEmbed API (see
https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview.html)

Author: Fridolin Linder

Usage:
    $> python add_tweets_to_task.py [sql_path] [tweet_file_path] [task_id]

Arguments:
    sqlite_path: sqlite database file (default `pairComp.sqlite3`)
    tweet_file_path: json file containing one tweet per line in twitter format
    task_id: id of the task the tweets shoud be added to
'''
import sqlite3
import sys
import json

from utils import read_tweet

if __name__ == '__main__':

    # Store the commandline arguments passed to the script
    SQLITE_PATH = sys.argv[1]
    TWEET_PATH = sys.argv[2]
    TASK_ID = sys.argv[3]

    conn = sqlite3.connect(SQLITE_PATH)
    c = conn.cursor()

    # For every tweet in the input json, generate extract the html and id
    tweet_list = []
    with open(TWEET_PATH, "r") as infile:
        for i,line in enumerate(infile):
            try:
                tweet = json.loads(line)
            except json.JSONDecodeError:
                print('Json decode error in line {}. Skipped'.format(i))
                continue
            tweet_html, tweet_id = read_tweet(tweet)

            if tweet_html is None:
                print("Skipping:", line)
                continue

            tweet_list.append((tweet_html, tweet_id))

    element_list = [(TASK_ID, x[0], x[1]) for x in tweet_list]
    element_ids = []
    for el_tup in element_list:
        c.execute('INSERT INTO elements (taskId, elementText, externalId) '
                  'VALUES (?,?,?)', el_tup)
        el_id = c.lastrowid
        element_ids.append(el_id)

    print("Element Count:", len(element_ids))


