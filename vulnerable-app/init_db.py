import sqlite3

def init_db():
    connection = sqlite3.connect('database.db')
    cur = connection.cursor()

    # Reset tables
    cur.execute("DROP TABLE IF EXISTS users")
    cur.execute("DROP TABLE IF EXISTS secrets")

    # Create tables
    cur.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, description TEXT)")
    cur.execute("CREATE TABLE secrets (id INTEGER PRIMARY KEY, flag TEXT)")

    # Insert dummy data and the actual flag
    cur.execute("INSERT INTO users (username, description) VALUES ('admin', 'System Administrator')")
    cur.execute("INSERT INTO users (username, description) VALUES ('guest', 'Limited privileges')")
    cur.execute("INSERT INTO secrets (flag) VALUES ('flag{sql_injection_success}')")

    connection.commit()
    connection.close()
    print("Database initialized successfully.")

if __name__ == '__main__':
    init_db()