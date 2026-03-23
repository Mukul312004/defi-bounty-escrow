from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('user', '')
    conn = get_db_connection()
    
    # ⚠️ VULNERABILITY: Raw string formatting allows SQL Injection
    sql_query = f"SELECT username, description FROM users WHERE username = '{query}'"
    
    try:
        results = conn.execute(sql_query).fetchall()
        conn.close()
        return jsonify({"success": True, "data": [dict(row) for row in results]})
    except sqlite3.Error as e:
        conn.close()
        # Returning the SQL error makes the injection easier to debug/exploit
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Run on 0.0.0.0 so Docker can map the port
    app.run(host='0.0.0.0', port=5000)