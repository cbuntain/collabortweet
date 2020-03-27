'''
This script imports tweets into an exsisting collabortweet task

If the tweet is
still available on Twitter, the html for the full rendered tweet (as it would
appear on Twitter) is extracted from the Twitter oEmbed API (see
https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview.html)

Author: Fridolin Linder

Usage:
    $> python add_tweets_to_task.py --sqlite_path [sql_path]
         --data_path [tweet_file_path] --task_id [task_id]

Arguments:
    sqlite_path: sqlite database file (default `database.sqlite3`)
    data_path: json file containing one tweet per line in twitter format
    task_id: id of the task the tweets shoud be added to
'''
import json
import argparse
import sqlite3

from utils import read_tweet

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='imports tweets into an exsisting collabortweet task'
    )
    parser.add_argument('--sqlite_path')
    parser.add_argument('--data_path')
    parser.add_argument('--task_id')
    args = parser.parse_args()

    # Store the commandline arguments passed to the script
    SQLITE_PATH = args.sqlite_path
    TWEET_PATH = args.data_path
    TASK_ID = int(args.task_id)

    conn = sqlite3.connect(SQLITE_PATH)
    c = conn.cursor()

    # For every tweet in the input json, generate extract the html and id
    tweet_list = []
    with open(TWEET_PATH, "r") as infile:
        for i, line in enumerate(infile):
            try:
                tweet = json.loads(line)
            except json.JSONDecodeError:
                print('Json decode error in line {}. Skipped'.format(i))
                continue


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
    
    conn.commit()
    conn.close()
