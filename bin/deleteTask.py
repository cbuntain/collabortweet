'''CLI script to delete task from collabortweet

Deletes the task + all records and exsisting labels (!)

Arguments:
    database: path to `.sqlite3` database file to delet task from.
    task_id: id of the task in `database`.

Authors: Cody Buntain, Fridolin Linder
'''

import sqlite3
import argparse

if __name__ == '__main__':

    # ==========================================================================
    # Parse commandline arguments
    # ==========================================================================

    parser = argparse.ArgumentParser()
    parser.add_argument('--database')
    parser.add_argument('--task_id')
    args = parser.parse_args()
    
    sqlitePath = args.database
    taskId = int(args.task_id)

    print("Deleting Task [%d] from: %s" % (taskId, sqlitePath))

    # Open the sqlite3 file
    conn = sqlite3.connect(sqlitePath)
    c = conn.cursor()

    # Delete all element labels
    c.execute("DELETE FROM elementLabels WHERE labelId IN"
              " (SELECT l.labelId FROM labels l WHERE l.taskId = :taskId)", 
        {"taskId": taskId})

    # Delete all elements
    c.execute("DELETE FROM elements WHERE taskId = :taskId", 
        {"taskId": taskId})

    # Delete all labels
    c.execute("DELETE FROM labels WHERE taskId = :taskId", 
        {"taskId": taskId})

    # Delete task
    c.execute("DELETE FROM tasks WHERE taskId = :taskId", 
        {"taskId": taskId})

    # Commit
    conn.commit()
    conn.close()

    print("Task Deleted.")
