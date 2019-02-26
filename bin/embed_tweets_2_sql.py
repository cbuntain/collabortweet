'''
This script imports tweets into the collabortweet platform.

If the tweet is
still available on Twitter, the html for the full rendered tweet (as it would
appear on Twitter) is extracted from the Twitter oEmbed API (see
https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview.html)

Author: Cody Buntain (creator), Fridolin Linder (modifications)

Usage:
    $> python embedTweets2sql.py [task_description_path] [sqlite_file_path]
    [tweet_json_path]

Arguments:
    task_description_path: json file with task data (see collabortweet
        documentation)
    sqlite_file_path: sqlite database file (default `pairComp.sqlite3`)
    tweet_json_path: json file containing one tweet per line in either twitter
    API format or GNIP format
'''
import sqlite3
import sys
import json
import html
import itertools
import random
import requests
import re


# ==============================================================================
# Function definitions
# ==============================================================================

def get_embed(username, tweet_id):
    '''Use Twitter's embed API endpoint to get the HTML for a tweet

    Arguments:
    ----------
    username: str, user's twitter screen name
    tweet_id: int, Twitter ID for the Tweet to be embedded
    default: str, default return value for tweets that can't be embedded

    Returns:
    ---------
    If tweet is available through API: str, html of embedded tweet
    If tweet is not available: default
    '''
    payload = {
        "url": html.escape("https://twitter.com/{}/status/{}".format(username,
                                                                     tweet_id))
    }
    req = requests.get('https://publish.twitter.com/oembed', params=payload)

    rendered_html = None

    # Try to get the HTML from Twitter's oEmbed API.
    #. we check if we get 200 Status OK code and if the "HTML" key is
    #. in the response before extracting it. Deleted tweets return 404,
    #. and some tweets return 403, which I assume means tweet is
    #. protected.
    try:
        if req.status_code == 200:
            resp = req.json()
            if "html" in resp:
                rendered_html = resp["html"] # replace default HTML
        else:
            print("Wrong Code:", req.status_code)
    except json.decoder.JSONDecodeError:
        print("Error on getting tweet:", tweet_id)
        print("Response Code:", req.status_code)
        print("Response:", req.text)

    return rendered_html

def get_field(obj, path, default=None):
    '''Get a field from a nested json via a path
    
    Arguments:    
    ----------
    obj: dict, object to extract data from
    path: str, path of keys to target field in format 'key1/key2/...'
    default: value to return if path is not available
    '''
    components = path.split('/')
    try:
        if len(components) == 1:
            return obj[components[0]] 
        else:
            return get_field(obj=obj[components[0]], 
                             path='/'.join(components[1:]), 
                             default=default)
    except KeyError:
        return default
    
def linkify(text):
    '''Takes text and transforms urls to html links'''
    regex = re.compile(r'(http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%'
                       r'[0-9a-fA-F][0-9a-fA-F]))+)')
    return regex.sub(r'<a href="\1" target="_blank">\1</a>', text)

def get_tweet_content(tweet):
    '''Get the relevant content of a tweet to be displayed to the labeler.

    The content returned depends on the tweet type (see Returns section).

    Arguments:
    ----------
    tweet, dict Tweet object (for now in Twitter format only. TODO: make work 
        with GNIP)

    Returns:
    ----------
    dict:
       {'type': ['tweet', 'retweet', 'quotetweet', 'retweet_of_quotetweet']
        'id'
        'author'
        'retweeted_author'
        'quoted_author'
        'replied_author'
        'text',
        'retweeted_text',
        'quoted_text'}
    If the field doesn't apply to the tweet the value is None.
    '''

    # Extract data or fill None if not available (see `get_field`)
    out = {
        'retweeted_author': get_field(tweet, 
                                          'retweeted_status/user/screen_name'),
        'quoted_author': get_field(tweet, 'quoted_status/user/screen_name'),
        'text': get_field(tweet, 'text'),
        'retweeted_text': get_field(tweet, 'retweeted_status/text'),
        'quoted_text': get_field(tweet, 'quoted_status/text'),
        'author': get_field(tweet, 'user/screen_name'),
        'id': get_field(tweet, 'id'),
        'replied_author': get_field(tweet, 'in_reply_to_screen_name')
    }

    # linkify text fields:
    for key in out:
        if 'text' in key:
            out[key] = linkify(out[key])
    
    # Determine tweet type
    rt = 'retweeted_status' in tweet
    qt = 'quoted_status' in tweet
    if not rt and not qt:         
        out['type'] = 'tweet'
    elif rt and not qt: 
        if 'quoted_status' in tweet['retweeted_status']:
            out['type'] = 'retweet_of_quotetweet'
        else:
            out['type'] = 'retweet'
    elif qt and not rt: 
        out['type'] = 'quotetweet'
    # Weird case where it has both 'retweeted_status' and 'quoted_status'
    # I don't completely understand this case (TODO). For now treated as
    # retweet
    else:
        out['type'] = 'retweet_of_quotetweet'

    return out

def read_tweet(tweet):
    '''Extract relevant content from tweet object

    Arguments:
    ---------
    tweet: dict, tweet in either native Twitter json format or GNIP format

    Returns:
    ---------
    html for the tweet (either as received from oembed endpoint or if tweet not
    available on twitter the extracted text with minimal html embedding.)
    '''
    html_templates = {
            'tweet': ('<pre>Tweet type: {type}</br>'
                      'Author: {author}</br>'
                      'Text: {text}</pre>'),
            'retweet': ('<pre>Tweet type: {type}</br>'
                        'Author: {author}</br>'
                        'Retweeted Author: {retweeted_author}</br>'
                        'Retweeted text: {retweeted_text}</pre>'),
            'quotetweet': ('<pre>Tweet type: {type}</br>'
                           'Author: {author}</br>'
                           'Text: {text}</br>'
                           'Quoted author: {quoted_author}</br>'
                           'Quoted text: {quoted_text}</pre>'),
            'retweet_of_quotetweet': ('<pre>Tweet type: {type}</br>'
                                      'Author: {author}</br>'
                                      'Retweeted author: {retweeted_author}</br>'
                                      'Retweeted text: {retweeted_text}</br>'
                                      'Quoted author: {quoted_author}</br>'
                                      'Quoted text: {quoted_text}</pre>'),
            'embedded': ('<pre>Tweet type: {type}</br>'
                         'Author: {author}</pre></br>{embedded}')
            }
    
    # Try to extract all info with consideration of tweet type (see
    # `get_tweet_content()`) this only works for standard twitter json format
    # (not GNIP) so if that fails, resort to the old way
    try:
        contents = get_tweet_content(tweet)
        tweet_id = contents['id']
        tweet_user = contents['author']
        ttype = contents['type']
        default_html = html_templates[ttype].format(**contents)
    except KeyError as e:
        if 'body' in tweet:
            tweet_text = temp.format(tweet["actor"]["preferredUsername"],
                                     tweet["body"])
            idstr = tweet["id"]
            tweet_id = int(idstr[idstr.rfind(":")+1:])
            tweet_user = tweet["actor"]["preferredUsername"]
            ttype = 'NA'
            default_html = html_templates['tweet'].format(type='',
                                                          author=tweet_user,
                                                          text=tweet_text)
        else:
            raise e

    # Try to get html from oembed endpoint
    rendered_html = get_embed(tweet_user, tweet_id)

    if rendered_html is not None:
        out_html = html_templates['embedded'].format(author=tweet_user,
                                                     type=ttype,
                                                     embedded=rendered_html)
    else:
        out_html = default_html

    return out_html, tweet_id

# ==============================================================================
# Script code
# ==============================================================================
if __name__ == '__main__':
    # Store the commandline arguments passed to the script
    TASK_DESC_PATH = sys.argv[1]
    SQLITE_PATH = sys.argv[2]
    TWEET_PATH = sys.argv[3]

    # If pairwise task get pair count
    if len(sys.argv) > 4:
        pair_count = int(sys.argv[4])
    else:
        pair_count = None

    # Load the task metadata from taskdescription
    with open(TASK_DESC_PATH, "r") as infile:
        task_desc = json.load(infile)
    print(task_desc)

    # For every tweet in the input json, generate extract the html and id
    tweetList = []
    with open(TWEET_PATH, "r") as infile:
        for line in infile:
            tweet = json.loads(line)

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
