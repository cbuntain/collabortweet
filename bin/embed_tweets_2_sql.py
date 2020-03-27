'''
This script imports tweets into the collabortweet platform.

If the tweet is
still available on Twitter, the html for the full rendered tweet (as it would
appear on Twitter) is extracted from the Twitter oEmbed API (see
https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview.html)

Author: Cody Buntain (creator), Fridolin Linder (modifications)

Arguments:
    task_path: json file with task data (see collabortweet
        documentation)
    sqlite_path: sqlite database file (default `database.sqlite3`)
    data_path: json file containing one tweet per line in either twitter
        API format or GNIP format

Usage:
    $> python embed_tweets_2_sql.py --task_path [task_description_path]
        --sqlite_path [sqlite_file_path] --data_path [tweet_json_path]
'''
import sqlite3
import json
import itertools
import random
import argparse

from utils import read_tweet

if __name__ == '__main__':
    # Store the commandline arguments passed to the script
    parser = argparse.ArgumentParser(
        description='Create new task and import tweets.'
    )
    parser.add_argument('--task_path')
    parser.add_argument('--sqlite_path')
    parser.add_argument('--data_path')
    parser.add_argument('--pair_count', default=None)
    args = parser.parse_args()

    TASK_DESC_PATH = args.task_path
    SQLITE_PATH = args.sqlite_path
    TWEET_PATH = args.data_path

    # If pairwise task get pair count
    pair_count = args.pair_count
    if pair_count is not None:
        pair_count = int(pair_count)

    # Load the task metadata from taskdescription
    with open(TASK_DESC_PATH, "r") as infile:
        task_desc = json.load(infile)
    print(task_desc)

    # For every tweet in the input json, generate extract the html and id
    tweetList = []
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

            tweetList.append((tweet_html, tweet_id))

    # Insert the data into the database
    conn = sqlite3.connect(SQLITE_PATH)
    c = conn.cursor()

    c.execute('INSERT INTO tasks (taskName, question, taskType) VALUES (:name,'
              ':question,:type)', task_desc)
    task_id = c.lastrowid
    print("Task ID:", task_id)

    element_list = [(task_id, x[0], x[1]) for x in tweetList]
    element_ids = []
    for el_tup in element_list:
        c.execute('INSERT INTO elements (taskId, elementText, externalId) '
                  'VALUES (?,?,?)', el_tup)
        el_id = c.lastrowid
        element_ids.append(el_id)

    print("Element Count:", len(element_ids))

    # Only create pairs if the task type == 1 (i.e. pairwise comparison task)
    if task_desc["type"] == 1:
        # Create the pairs
        pair_list = None

        # If we didn't specify a number of pairs, find all
        if pair_count is None:
            pair_list = itertools.combinations(element_ids, 2)
        else: # Otherwise, randomly select k pairs
            pair_accum = set()
            for e_index, e_id in enumerate(element_ids):
                start_index = max(0, e_index-1)
                others = element_ids[:start_index] + element_ids[e_index+1:]

                # Put the pair in canonical order to avoid duplicates
                new_pairs = set(map(lambda x: (min(e_id, x), max(e_id, x)),
                                    random.sample(others, pair_count)))

                pair_accum = pair_accum.union(new_pairs)

            pair_list = list(pair_accum)

        pair_list = [(task_id, x[0], x[1]) for x in pair_list]
        print("Pair Count:", len(pair_list))

        c.executemany('INSERT INTO pairs (taskId, leftElement, rightElement) '
                      'VALUES (?,?,?)', pair_list)

    # If we are dealing with a labeling task (type == 2), insert the labels
    elif task_desc["type"] == 2:

        print("Insert labels...")
        label_list = [{"taskId": task_id, "labelText": x}
                      for x in task_desc["labels"]]
        print(label_list)

        c.executemany('INSERT INTO labels (taskId, labelText) VALUES (:taskId,'
                      ':labelText)', label_list)

    # Otherwise, we have an invalid task type
    else:
        conn.close()
        raise ValueError(
            "ERROR! Task type '{}' is not valid!".format(task_desc["type"]))

    conn.commit()
    conn.close()
