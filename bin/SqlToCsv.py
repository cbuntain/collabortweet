
# coding: utf-8

# In[ ]:

import sqlite3
import sklearn.metrics
import statsmodels.stats.inter_rater
import pandas as pd


# # Connect to SQLite DB

# In[ ]:

conn = sqlite3.connect('./pairComp.sqlite3')
c = conn.cursor()


# # Get Labelers

# In[ ]:

userMap = {}
for userRow in c.execute("SELECT userId, fname, lname FROM users"):
    userName = "%s %s" % (userRow[1], userRow[2])
    userMap[userRow[0]] = userName
    print(userRow[0], userName)
#print userMap


# # Get Tasks

# In[ ]:

for taskRow in c.execute("SELECT taskId, taskName, taskType FROM tasks"):
    print("Task ID:", taskRow[0], "Type:", taskRow[2], "Name:", taskRow[1])


# # Convert SQL Labels to CSV File
# 
# Each task will be dumped to a CSV file. Each CSV file will contain rows, one row for each user-label pair for each labeled element in that task.

# In[ ]:

taskRows = c.execute("SELECT taskId, taskName FROM tasks WHERE taskType == 2").fetchall()

for r in taskRows:
    taskName = r[1]
    taskId = r[0]
    
    # Task name
    print("Task Name:", taskName)
    
    # Get the number of elements you want to label
    eCount = c.execute("SELECT COUNT(*) FROM elements WHERE taskId = ?", (taskId, )).fetchone()
    print("Number of Elements to Label:", eCount[0])
    
    # How many labels do we actually have?
    #  Each user contributes a label, so this number could be at max:
    #  number of labelers * number of elements to label
    lCount = c.execute("SELECT COUNT(*) " + \
        "FROM elementLabels el JOIN elements e " + \
        "ON e.elementId = el.elementId " + \
        "WHERE e.taskId = ?", 
        (taskId, )).fetchone()
    print("Number of Labels:", lCount[0])
    
    # Print the users who participated in this task
    userLabelCounts = {}
    print("Users who Labeled:")
    labelerList = c.execute("SELECT DISTINCT userId " + \
        "FROM elementLabels el JOIN elements e " + \
        "ON e.elementId = el.elementId " + \
        "WHERE e.taskId = ?", 
        (taskId, )).fetchall()
    labelerList = list(map(lambda x: x[0], labelerList))
    for labelerId in labelerList:
        name = userMap[labelerId]
        
        userCount = c.execute("SELECT COUNT(*) " + \
            "FROM elementLabels el JOIN elements e " + \
            "ON e.elementId = el.elementId " + \
            "WHERE e.taskId = ? AND el.userId = ?",
            (taskId, labelerId)).fetchone()
        userLabelCounts[labelerId] = userCount[0]
        print("\t", name, " - ", userCount[0], "Labels")
        
        
    # Get the tweet IDs for each label
    dataSamples = []
    elementAndLabelList = c.execute("SELECT el.elementId, el.labelId, el.userId, " + \
         "e.externalId, l.labelText, l.taskId, e.elementText, " + \
         "u.screenname " + \
         "FROM elementLabels el JOIN elements e " + \
         "ON e.elementId = el.elementId " + \
         "JOIN labels l ON el.labelId = l.labelId " + \
         "JOIN users u ON el.userId = u.userId " + \
         "WHERE e.taskId = ?", (taskId, )).fetchall()
    # For each element in the row, convert it to a map and add it to our 
    #  list of samples. NOTE: If you want to add text here
    for row in elementAndLabelList:
        dataSample = {
            "external_id": row[3],
            "label": row[4],
            "user_id": row[2],
            "username": row[7],
            "text": row[6],
        }
        dataSamples.append(dataSample)

        
    labelDf = pd.DataFrame(dataSamples)
    
    # Add "text" to the list below to add text to the resulting CSV
    labelDf[["external_id", "user_id", "username", "label"]].sort_values(by="external_id").to_csv("task_id_%03d.csv" % taskId, index=False)
    


# In[ ]:

labelerList


# In[ ]:



