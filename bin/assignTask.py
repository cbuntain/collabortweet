'''CLI script to assign task to user from collabortweet


Allows admin to assign tasks to non-admin users,
for the purpose of restricting views

Arguments:
    database: path to `.sqlite3` database file to delet task from.
    task_id: id of the task in `database`.

Authors: Cody Buntain, Fridolin Linder, Ian Rosenberg
'''

import sqlite3
import argparse

if __name__ == '__main__':

    # ==========================================================================
    # Parse commandline arguments
    # ==========================================================================

    parser = argparse.ArgumentParser()
    parser.add_argument('--database')
    parser.add_argument('--user')
    parser.add_argument('--task_id')
    args = parser.parse_args()
    
    sqlitePath = args.database
    taskId = int(args.task_id)
    username = args.user

    print("Restricting task views for %s  Task ID: [%d] from: %s" % (username, taskId, sqlitePath))

    # Open the sqlite3 file
    conn = sqlite3.connect(sqlitePath)
    c = conn.cursor()

    param = (username,);

    c.execute("SELECT * FROM users WHERE screenname = ?", param)

    row = c.fetchall()

    userID = row[0][0]

    fields = (taskId,userID,taskId,userID,) 

    # Assign user a task ID
    c.execute("INSERT INTO assignedTasks(taskId,userId) SELECT ?, ?" 
        "WHERE NOT EXISTS(SELECT 1 FROM assignedTasks WHERE taskId = ? AND userId = ?)", fields)

    # Commit
    conn.commit()
    conn.close()

    print("Task ", taskId, " assigned to user ", username)
