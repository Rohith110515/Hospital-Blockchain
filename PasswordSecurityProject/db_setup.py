import sqlite3

conn = sqlite3.connect('passwords.db')

cursor = conn.cursor()

cursor.execute('''

CREATE TABLE IF NOT EXISTS password_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    password TEXT,

    score INTEGER,

    strength TEXT
)

''')

conn.commit()

conn.close()

print("Database Created Successfully")