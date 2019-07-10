'''
This script extracts labels from the database and evaluates coder quality
using all labeled elements that overlap between all coders.

Author: Fridolin Linder

Arguments:
    db_path: str, path of the sqlite databasefile
    task_ids: iterable of integers, Collabortweet task ID(s)
    gold_standard_coder: str, Collabortweet screenname for the gold standard coder. If omitted,
        no evaluation is done and all labeled elements are stored in `output`.
    output: str, path where to store the output csv file
    time_cutoff: int, optional, seconds to use as cutoff for the labeling time for each element
        (default is 60*3)

Returns:
    Prints evaluation metrics and summary stats for every coder. If gold standard coder is provided
    (`--gold_standard_coder`) accuracy in recovering this coder's labels is reported as well.
    The curated data is returned in csv format with columns:
        - 'externalId': Id of the element
        - 'label': Label given by coder (if multiple coders labled the element the label according
           to plurality vote is given)
        - 'entropy': The shannon entropy of the labels for elements with multiple coders, NA for
           elements with single coder
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

def print_summary(title, data):
    print('+'*80)
    print(f'{title}:')
    print('+'*80)
    print(data)
    print('+'*80)
    print('\n')

# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
# Parse input arguments
# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
parser = argparse.ArgumentParser()
parser.add_argument('--db_path', type=str)
parser.add_argument('--task_ids', nargs='+', type=int)
parser.add_argument('--gold_standard_coder', type=str, default=None)
parser.add_argument('--output', type=str)
parser.add_argument('--time_cutoff', type=int, default=180)
args = parser.parse_args()

DB_PATH = args.db_path
CUTOFF = args.time_cutoff
TASK_IDS = args.task_ids
EVAL_USER = args.gold_standard_coder
OUTPATH = args.output

# ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

# Don't truncate pandas dataframes when printing coder stats
pd.set_option('display.max_colwidth', -1)
pd.set_option('display.max_columns', None)

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

# Number of labels per coder and overlap with every other coder
ccols = labels[['externalId', 'screenname', 'labelText']].pivot(
    index='externalId', columns='screenname', values='labelText'
)
ccols = ccols.notna()
out = []
for coder in coders:
    tempdf = ccols[ccols[coder]]
    o = tempdf.sum(axis=0)
    o['screenname'] = coder
    out.append(o)
sumdf = pd.DataFrame(out)
sumdf = sumdf[['screenname'] + list(coders)]
sumdf.set_index('screenname', inplace=True, drop=True)
for i in range(0, sumdf.shape[0]):
    for j in range(0, sumdf.shape[1]):
        if i > j:
            sumdf.iloc[i, j] = np.nan
sumdf['total'] = sumdf.max(axis=0)
print_summary('Number of coded elements per coder and overlap with other coders', sumdf)

# Calculate average time per tweet for each labeler
labels['time_delta'] = pd.to_datetime(labels['time']).diff()

# Remove time deltas larger than CUTOFF
CUTOFF = 60*3
time_df = copy.copy(labels.dropna())
time_df['time_delta'] = [x.seconds for x in time_df['time_delta']]
time_df = time_df[time_df['time_delta'] <= CUTOFF]
time_df = time_df[['screenname', 'time_delta']].groupby('screenname')\
                                               .agg(['median', 'mean'])

time_df.reset_index(inplace=True, drop=False)
time_df.columns = ['coder', 'median_time', 'mean_time']
time_df.set_index('coder', drop=True, inplace=True)
print_summary('Time spent on coding task', time_df)

# Calculate cohens cappa for all coder pairs
kappas = []
for coder_pair in itertools.combinations(coders, 2):
    tempdf = labels[labels['screenname'].isin(coder_pair)]
    label_counts = tempdf[['externalId', 'screenname']].groupby('externalId').count()
    overlapping_ids = label_counts[label_counts['screenname'] == 2].index
    if len(overlapping_ids) == 0:
        kappa = np.nan
    else:
        eval_df = tempdf.pivot(index='externalId', columns='screenname', values='labelText')
        eval_df = eval_df.loc[overlapping_ids]
        cm = confusion_matrix(eval_df[[coder_pair[0]]], eval_df[[coder_pair[1]]])
        kappa = cohens_kappa(cm)
        kappas.append((*coder_pair, kappa['kappa'], len(overlapping_ids)))
kappas = pd.DataFrame(kappas, columns=['coder_1', 'coder_2', 'kappa', 'overlapping_elements'])
kappas.set_index(['coder_1', 'coder_2'], drop=True, inplace=True)
print_summary("Cohen's Kappa for all coder pairs", kappas)

avg_kappas = []
kappas.reset_index(drop=False, inplace=True)
for coder in coders:
    val = kappas[(kappas['coder_1'] == coder) |
                 (kappas['coder_2'] == coder)]['kappa'].mean()
    avg_kappas.append((coder, val))
avg_kappas = pd.DataFrame(avg_kappas, columns=['coder', 'avg_kappa'])
avg_kappas.set_index('coder', inplace=True, verify_integrity=True)
print_summary("Average Cohen's Kappa by coder", avg_kappas)

if EVAL_USER is not None:
    # Give overview of how many tweets were labeled by each coder + overlap with Gold standard
    gs_ids = set(labels[labels['screenname'] == EVAL_USER]['externalId'])
    out = []
    for coder in coders:
        if coder == EVAL_USER:
            continue
        # Get the number of labels provided by this coder
        coder_ids = set(labels[labels['screenname'] == coder]['externalId'])

        # Get the ids that overlap with gold standard (if any)
        overlapping_ids = coder_ids.intersection(gs_ids)

        if len(overlapping_ids) > 0:
            # Calculate the % agreement on the overlapping labels
            tempdf = labels[labels['screenname'].isin([coder, EVAL_USER])]
            tempdf = tempdf[tempdf['externalId'].isin(overlapping_ids)]
            tempdf = tempdf.pivot(index='externalId', columns='screenname', values='labelText')
            acc = accuracy_score(tempdf[EVAL_USER], tempdf[coder])
        else:
            acc = np.nan

        # Get the stats on overlapping and total coded elements
        out.append({'coder': coder,
                    'gold_standard_accuracy': acc,
                    'total': len(coder_ids),
                    'unique': len(coder_ids.difference(gs_ids)),
                    'overlap_gold_standard': len(overlapping_ids),})

    sumdf = pd.DataFrame(out)
    # Change col order and row index for nicer display
    #sumdf = sumdf[['coder', 'total', 'unique', 'overlap_gold_standard']]
    sumdf.set_index('coder', drop=True, inplace=True)
    print_summary(f'Comparison to gold standard coder ({EVAL_USER})', sumdf)

label_count = labels[['externalId', 'labelText']].groupby('externalId').count()
multi_labeled_ids = label_count[label_count['labelText'] > 1].index
multi_labeled = labels[labels['externalId'].isin(multi_labeled_ids)]

multi_labeled = multi_labeled.pivot(index='externalId', columns='screenname', values='labelText')

# Create the labels output

## Get the plurality vote for the overlapping elements
eval_label_counts = multi_labeled.apply(lambda row: row.value_counts(), axis=1)

eval_label_counts.fillna(0, inplace=True)
eval_labels = pd.DataFrame(eval_label_counts.idxmax(axis=1), columns=['label'])
eval_labels['entropy'] = eval_label_counts.apply(
    lambda row: entropy(row/len(coders)), axis=1
)
eval_labels.columns = ['label', 'entropy']

## Extract the labels for the rest of the data
final_labels = labels[~labels['externalId'].isin(multi_labeled_ids)][['externalId', 'labelText']]
final_labels['entropy'] = np.nan
final_labels.set_index('externalId', inplace=True)
final_labels.columns = ['label', 'entropy']
final_labels = pd.concat([eval_labels, final_labels])

print(f'Storing output data in {OUTPATH}')
final_labels.to_csv(OUTPATH)
