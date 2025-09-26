import os, sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data/database.db")

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _column_exists(con, table, col):
    rows = con.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r["name"] == col for r in rows)

def init_db():
    with db() as con:
        con.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            room TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL
        )
        """)
        if not _column_exists(con, "rooms", "guest_enabled"):
            con.execute("ALTER TABLE rooms ADD COLUMN guest_enabled INTEGER NOT NULL DEFAULT 0")
        con.execute("""
        CREATE TABLE IF NOT EXISTS timers (
            room TEXT PRIMARY KEY,
            running INTEGER NOT NULL DEFAULT 0,
            start_ts REAL,
            elapsed_ms INTEGER NOT NULL DEFAULT 0
        )""")
