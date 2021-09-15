'''
Import a single user or a list of users to the application
Author: Fridolin Linder
'''
import argparse
import sqlite3
import pandas as pd

if __name__ == '__main__':
    
    # Parse commandline arguments
    parser = argparse.ArgumentParser(
        description='Ad a single user or multiple users to the application'
    )
    parser.add_argument('--sqlite_path')
    parser.add_argument('--users_file')
    parser.add_argument('--screenname')
    parser.add_argument('--password')
    parser.add_argument('--first_name')
    parser.add_argument('--last_name')
    parser.add_argument('--admin')
    args = parser.parse_args()
    
    # Establish database connection
    conn = sqlite3.connect(args.sqlite_path)
    c = conn.cursor()
    
    # Add many users from a csv file
    if args.users_file is not None:
        user_data = []
        users = pd.read_csv(args.users_file)
        for index, user in users.iterrows():
            user_data.append([x for x in user])
        c.executemany(
            ('INSERT INTO users (screenname, password, fname, lname) VALUES '
            '(?, ?, ?, ?)'), 
            user_data
        )
    # Add a single user from cli
    else:
        user_data = (args.screenname, args.password, args.first_name, 
                     args.last_name, args.admin)
        c.execute(
            ('INSERT INTO users (screenname, password, fname, lname, isadmin) VALUES (?,'
             '?, ?, ?, ?)'), 
             user_data
        )

    conn.commit()
    conn.close()
