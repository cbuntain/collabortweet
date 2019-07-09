'''
This script extracts labels from the database and evaluates coder quality
using all labeled elements that overlap between all coders. If gold standard
codeer is provided accuracy in revovering that coder's labels is reported as well.

Arguments:
    db_path: str, path of the sqlite databasefile
    task_ids: iterable of integers, Collabortweet task ID(s)
    multi_label_resolution: str, method to use to assign a label to each element if there are
        multiple labels for that element. Default is plurality (i.e. the label that has most
        'votes', in case of ties a random label is choosen from the tied ones) can also be the
        screenname of one of the coders (e.g. if a gold standard coder is proved), in that case
        that coder's labels are used for all overlapping elements.
    gold_standard_name: str, Collabortweet screenname for the gold standard coder
    output: str, path where to store the output csv file
    time_cutoff: int, optional, seconds to use as cutoff for the labeling time for each element
        (default is 60*3)
'''

import itertools
import copy
import argparse
import sqlite3
import numpy as np
import pandas as pd
from statsmodels.stats.inter_rater import cohens_kappa
from sklearn.metrics import confusion_matrix, accuracy_score
from scipy.stats import entropy

# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
# Parse input arguments
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
parser = argparse.ArgumentParser()
parser.add_argument('--db_path', type=str)
parser.add_argument('--task_ids', nargs='+', type=int)
parser.add_argument('--multi_label_resolution', type=str, default='majority')
parser.add_argument('--gold_standard_name', type=str, default=None)
parser.add_argument('--output', type=str)
parser.add_argument('--time_cutoff', type=int, default=180)
args = parser.parse_args()

DB_PATH = args.db_path
CUTOFF = args.time_cutoff
TASK_IDS = args.task_ids
EVAL_USER = args.gold_standard_name
OUTPATH = args.output
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

# Get the raw labels from the database
db_connection = sqlite3.connect(DB_PATH)
query = '''
SELECT elements.elementId, externalId,
       elements.taskId,
       elementLabels.userId,
       elementLabels.labelId,
       elementText,
       screenname,
       labelText,
       elementLabels.time
    FROM elementLabels
    LEFT JOIN elements ON elementLabels.elementId = elements.elementId
    LEFT JOIN users ON elementLabels.userId = users.userId
    LEFT JOIN labels ON elementLabels.labelId = labels.labelId
    WHERE elements.taskId IN ({task_ids});
'''.format(task_ids=','.join([str(x) for x in TASK_IDS]))
labels = pd.read_sql_query(query, db_connection)

# Remove duplicated element/coder pairs (collabortweet artifacts)
labels = labels[~labels.duplicated(subset=['externalId', 'screenname'])]
coders = labels['screenname'].unique()

# Find the eval tweets (tweets that are overlapping between all coders)
label_counts = labels[['externalId', 'screenname']].groupby('externalId').count()
eval_ids = label_counts[label_counts['screenname'] == len(coders)].index

eval_df = labels.pivot(index='externalId', columns='screenname', values='labelText')
eval_df = eval_df.loc[eval_ids]

# Calculate cohens cappa for all coder pairs
kappas = []
for coder_pair in itertools.combinations(coders, 2):
    cm = confusion_matrix(eval_df[coder_pair[0]], eval_df[coder_pair[1]])
    kappa = cohens_kappa(cm)
    kappas.append((*coder_pair, kappa['kappa']))
kappas = pd.DataFrame(kappas, columns=['coder_1', 'coder_2', 'kappa'])

avg_kappas = []
for coder in coders:
    val = kappas[(kappas['coder_1'] == coder) |
                 (kappas['coder_2'] == coder)]['kappa'].mean()
    avg_kappas.append((coder, val))
avg_kappas = pd.DataFrame(avg_kappas, columns=['coder', 'avg_kappa'])
avg_kappas.set_index('coder', inplace=True, verify_integrity=True)

# If gold standard coder is given, calculate agreement kappa and %agreement
gs_agreement = []
if EVAL_USER is not None:
    eval_labels = eval_df[EVAL_USER]
    for coder in coders:
        if coder == EVAL_USER:
            continue
        val = accuracy_score(eval_labels, eval_df[coder])
        gs_agreement.append((coder, val))
    gs_agreement = pd.DataFrame(
        gs_agreement, columns=['coder', 'gold_standard_accuracy']
    )
    gs_agreement.set_index('coder', inplace=True, verify_integrity=True)

# Calculate average time per tweet for each labeler
labels['time_delta'] = pd.to_datetime(labels['time']).diff()

# Remove time deltas larger than CUTOFF
CUTOFF = 60*3
time_df = copy.copy(labels.dropna())
time_df['time_delta'] = [x.seconds for x in time_df['time_delta']]
time_df = time_df[time_df['time_delta'] <= CUTOFF]
time_df = time_df[['screenname', 'time_delta']].groupby('screenname')\
                                               .agg(['median', 'mean'])

time_df.columns = ['median_time', 'mean_time']

## Get the number of elements each coder labeled
## eval and non_eval
labels['is_eval'] = labels['externalId'].isin(eval_ids)
n_labels = labels[['screenname', 'is_eval', 'labelText']].groupby(
    ['screenname', 'is_eval']
).count()
n_labels.reset_index(inplace=True)
n_labels = n_labels.pivot(
    index='screenname', columns='is_eval', values='labelText'
)
n_labels.columns = ['unique_elements', 'overlapping_elements']

coder_stats = avg_kappas.join(time_df).join(n_labels)

# Join it all into one table
if EVAL_USER is not None:
    coder_stats = coder_stats.join(gs_agreement)

## Print summary stats
print(coder_stats)

# Create the labels output

## Get the plurality vote for the overlapping elements
eval_label_counts = eval_df.apply(lambda row: row.value_counts(), axis=1)
eval_label_counts.fillna(0, inplace=True)
eval_labels = pd.DataFrame(eval_label_counts.idxmax(axis=1), columns=['label'])
eval_labels['entropy'] = eval_label_counts.apply(
    lambda row: entropy(row/len(coders)), axis=1
)
eval_labels.columns = ['label', 'entropy']

## Extract the labels for the rest of the data
final_labels = labels[~labels['externalId'].isin(eval_ids)][['externalId', 'labelText']]
final_labels['entropy'] = np.nan
final_labels.set_index('externalId', inplace=True)
final_labels.columns = ['label', 'entropy']
final_labels = pd.concat([eval_labels, final_labels])

final_labels.to_csv(OUTPATH)
