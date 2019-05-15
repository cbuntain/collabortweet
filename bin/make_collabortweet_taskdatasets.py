'''
This script takes a sample of tweets in json format and splits them up for
collabortweet labeling.


Given the inputs, the data is split up into equal sized task datasets for each
of the [n_labelers] labeler. Each task dataset also contains a overlapping set
of evaluation tweets of size [n_evaluation_tweets] that will also be stored
separately.

Arguments:
    input_data: json file with one tweet per line.
    n_partitions: The number of 'workers' for the task.
    n_eval: The number of overlapping tweets between labelers for
        evaluation.
    ouput_prefix: Prefix for the filenames for the output files (see below).
    seed: optional, seed to use to split up the files randomly if not given
        default value 88332 is used for replicability.
Returns:
    - [output_prefix]_eval.json
    - [output_prefix]_worker_[x].json for x in n_labelers

Usage:
    python make_collabortweet_taskdatasets.py --input_data [input_file]
    --n_partitions [n] --n_eval [n] --output_prefix
    [prefix]

Author: Fridolin Linder
'''
import argparse
import json

import numpy as np

def random_partition(lst, n):
    '''Partition a list into n (near) equal length partitions
    adapted from: https://stackoverflow.com/questions/2659900/
                  python-slicing-a-list-into-n-nearly-equal-length-partitions
    '''
    np.random.shuffle(lst)
    division = len(lst) / n
    return [lst[round(division*i):round(division*(i+1))] for i in range(n)]


if __name__ == "__main__":

    # ==========================================================================
    # Parse commandline arguments
    # ==========================================================================

    parser = argparse.ArgumentParser(
        description='Draw random sample from collection'
    )
    parser.add_argument('--input_data')
    parser.add_argument('--n_partitions')
    parser.add_argument('--n_eval')
    parser.add_argument('--output_prefix')
    parser.add_argument('--seed', default=88332)
    args = parser.parse_args()

    np.random.seed(args.seed)

    n_eval = int(args.n_eval)
    n_partitions = int(args.n_partitions)
    input_data = args.input_data
    output_prefix = args.output_prefix

    # Count the number of lines in the input file (and check if valid)
    print('Checking input file...')
    with open(input_data) as infile:
        for i, line in enumerate(infile):
            tweet = json.loads(line)

    n_tweets = i + 1
    all_idxs = set(range(0, n_tweets))
    print(f'Number of tweets: {n_tweets}')

    # Assign eval indices:
    eval_idxs = set(np.random.choice(list(all_idxs), n_eval, replace=False))

    # Assign what remains as to be split up between workers
    rem = all_idxs - eval_idxs
    partitions = random_partition(list(rem), n_partitions)

    # Add the eval tweets to each partition
    pl = [str(len(x)) + f'(+{n_eval})' for x in partitions]
    partitions = [p + list(eval_idxs) for p in partitions]
    print(f'Generating {len(partitions)} partitions of sizes(+eval size): {pl}')

    # Create a mapping of index --> partition file connection to write output

    ## Open file connections for all parts
    part_conns = [open(output_prefix + f'_partition_{p}.json', 'w')
                  for p in range(n_partitions)]
    eval_conn = open(output_prefix + '_eval.json', 'w')

    ## Map indices to connections according to partitioning
    index = {}
    for p, partition in enumerate(partitions):
        for idx in partition:
            index[idx] = part_conns[p]
    for idx in eval_idxs:
        index[idx] = eval_conn

    # Go through input and write to connections
    with open(input_data) as infile:
        for idx, line in enumerate(infile):
            index[idx].write(line)

    for p_con in part_conns:
        p_con.close()
    eval_conn.close()
