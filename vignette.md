# HOWTO use collabortweet for SMaPP members and collaborators


## Log on to the Collabortweet digital ocean server

In principle you can run host collabortweet on any machine if you want to. Here we only show you how to use the dedicated server we have for this purpose at SMaPP. Running it on a different Linux machine should be straight forward.

Contact Megan [](meganbrown@nyu.edu) or anybody else with access to the Collabortweet server and give them your ssh public key.  

In your terminal of choice, use ssh to log on to the server:

```{bash}
ssh root@178.128.157.54 -i path/to/privat/key
```

## Create a directory for your project

All labeling project directories should be located in `/home`:

After logging in navigate to the `/home` and create your project directory there:
```
cd /home
mkdir my_project
```

## Upload the data you want to label to the server

On your local computer (or the computer you want to transfer the data from, e.g. the prince cluster) run the following command to upload your data:
```
scp -i path/to/private/key path/to/data/file.json root@178.128.157.54:/home/my_project
```

## Install collabortweet

Now we download the collabortweet platform from the GitHub repo:

```
cd /home/my_project
git clone https://github.com/smappnyu/collabortweet
```

## Set up the project

First we need to configure what port to run the server on and where to store all data. To figure out if a port is in use by another project, choose a port number between 3000 and 7000. Then check if another application is running by navigating in a web browser of your choice to `178.128.157.54:XXXX`, where `XXXX` refers to the port number.

Open `/home/my_project/collabortweet/CONFIG.json` and edit the `port` entry to `XXXX`. You can also change the `db_path` field. `db_path` tells the application where to store all the data. It might also be a good idea to set up some form of backup for this file for larger projects to make sure labels are not lost accidentally.

Now run the setup with:

```
python SETUP.py
```

This will install all dependencies for the webapp and create the empty database schema that holds the data.

## Adding Users

Now that the database is set up we can add user or coders, the people that will use the application:

You can either add many users at once or single users at a time.

### Adding many users

Create a `.csv` file containing all users that you want to add, in the following format (one user per row):
```
screenname,password,first_name,last_name
exampleuser,12345,example,user
...,...,...,...
...,...,...,...
```

Then import the users with the import script by running the following command (from the `collabortweet` directory):

```
python bin/add_users.py --sqlite_path [database_file_path] --users_file [user_csv_file]
```

The `[database_file_path]` is the path that's specified as `db_path` in `CONFIG.json` (drop the brackets).

### Adding a single user

You can add a single user at a time via the command line interface of the user import script:

```
python bin/add_users.py --sqlite_path [database_file_path] --screenname exampleuser --password 12345 --first_name example --last_name user
```

## Creating Tasks

### The task description file

The platform can run multiple tasks simultaneously. A task is a set of elements to be labeled that can be accessed by all users that have been added in the previous step.
In order to create a task, you need to write a task configuration file. The collabortweet repo contains an example of such a file (`labelTaskDesc.json`): 

```
{
	"name": "Nigeria 2015 - Relevance Labels",
	"question": "Is this tweet relevant to the Nigerian 2015 election?",
	"type": 2,
	"labels": [
		"Relevant",
		"Not Relevant",
		"Not English",
		"Can't Decide"
	]
}
```
- Name: Name of the task as it will appear on the platform
- Question: Question to ask of the coders
- Type: 1 is a pairwise comparison task (omitted from this documentation for now), 2 is a 'classical' labeling task
- labels: The choices of labels to give to the coders for each object

### Creating a task and importing data

When the data is imported, tweets that are still available on Twitter will be displayed as a tweet would be on the platform itself. If the tweet is not available any longer, just the text of the tweet is displayed. To import your data you can use the following script (from the `collabortweet` directory):

```
python bin/embed_tweets_2_sql.py --task_path [task_file.json] --sqlite_path [database_file_path] --data_path [path_to_tweets_file.json]
```

### Adding data to a running task

To add tweets to a task, look up the task ID of the task you want to add tweets to. You can find the task ID either on the web interface in the header of each task, or by looking it up directly in the database table. Then use the following script:

```
python bin/add_tweets_to_task.py --sqlite_path [database_file_path] --task_id [integer_id] --data_path [path_to_additional_data.json]
```

### Starting the server

If you followed all steps above, you should now be ready to run the server. To do so, from the `collabortweet` directory, run:
```
npm start
```

The only output you should see is `Starting server...`. If you see any other error messages, check if you followed all the steps above and if so contact Megan, Cody or Frido. 
Now the application is available on the WWW at `http://178.128.157.54:XXXX/` where `XXXX` is the port number you chose above.

### Downloading the labeled data

When the job is complete, you can download the data you can either use `bin/SqlToCsv.py` to get all tweets from all tasks, or `retrieve_partitioned_task.py` (see below for more info).


## Additional helpful scripts

### Dividing data into partially overlapping partitions for coder evaluation

If you have a job with multiple undergraduate coders and you want to split up tweets among them while still keeping track of their individual performance, collabortweet offers utilities for the following approach: Split up the complete dataset into an evaluation set (e.g. 100 randomly sampled tweets) and the remainder of the data. The remainder is split up evenly among the n undergraduate coders (without overlap). The evaluation set is then added to the partition of each coder in order to have overlap for calculating reliability statistics. Additionally, if there is one 'gold standard' coder (e.g. the researcher running the task), this gold standard coder can label the evaluation set to get not only inter-coder reliability but also coder-accuracy for recovering the gold standard.

To quickly set up such a task there are two scripts in the `bin/` directory. First, we partition the data:

```
python bin/partition_data.py --input_data [path_to_data.json] --n_partitions [n] --n_eval [number of eval elements] --output_prefix [prefix for output files] --seed [integer seed]
```

If no seed is set, the same seed is used every time the script is run, to be able to replicate specific partitioning. This script will generate the following set of files:
- `[output_prefix]_eval.json`
- `[output_prefix]_partition_[x].json for x in n_coders`

These files now can be used to create a separate task for each coder (based on data in `[output_prefiix]_partition_[x].json` files) as well as for the gold standard coder (based on data in `[output_prefix]_eval.json`). That is, you need to create a separate task file for each partition, ideally with the name of the assigned coder in it. 

### Retrieving partitioned data

You can use `bin/retrieve_partitioned_task.py` to get the data from the partitioned task as well as statistics on reliability and accuracy. Use:
```
python bin/retrieve_partitioned_task.py -h
```

For help on how to use this script.
