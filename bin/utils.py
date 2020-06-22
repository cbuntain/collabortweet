'''Utilities to process tweets for import into the database

Authors: Fridolin Linder, Cody Buntain
'''
import sqlite3
import json
import html
import re
import requests

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
        elif obj[components[0]] is None:
            return default
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
        'retweeted_author': get_field(
            tweet, 'retweeted_status/user/screen_name'),
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
        if 'text' in key and out[key] is not None:
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
                                  'Tweet text: {text}</br>'
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
            idstr = tweet["id"]
            tweet_id = int(idstr[idstr.rfind(":")+1:])
            tweet_user = tweet["actor"]["preferredUsername"]
            default_html = html_templates['tweet'].format(type='',
                                                          author=tweet_user,
                                                          text=tweet['body'])
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

def insert_labels(cursor, label_list, task_id, parent_label=-1):

    print("Inserting labels...")
    if parent_label > 0:
        print("\tSublabel of:", parent_label)

    for label in label_list:

        if isinstance(label, str):
            cursor.execute(
                'INSERT INTO labels (taskId, labelText, parentLabel) VALUES (:taskId, :labelText, :parentLabel)', 
                {"taskId": task_id, "labelText": label, "parentLabel": parent_label}
                )

        elif isinstance(label, dict):
            for label_text, sublabels in label.items():
                cursor.execute(
                    'INSERT INTO labels (taskId, labelText, parentLabel) VALUES (:taskId, :labelText, :parentLabel)', 
                    {"taskId": task_id, "labelText": label_text, "parentLabel": parent_label}
                    )
                this_parent_label = cursor.lastrowid

                insert_labels(cursor, sublabels, task_id, this_parent_label)

def insert_ranges(cursor, task_id, name, questions):
        if len(questions) > 0:
                for question in questions:
                        scaleSep = ","
                        scale = scaleSep.join(str(question["scale"]))

                        print(scale)

                        data = [question["question"], task_id]

                        cursor.execute('INSERT INTO rangeQuestions (rangeQuestion, taskId) VALUES (?,?)', data)
                        tempId = cursor.lastrowid

                        i = 1
                        for val in question["scale"]:
                                rangeVals = [tempId, val, i]
                                cursor.execute('INSERT INTO rangeScales (rangeQuestionId, rangeValue, rangeOrder) VALUES (?,?,?)', rangeVals)
                                i += 1
                print("Done inserting range task")
