"""Run:  python show_db.py   - prints what is stored in the database (for your project demo)."""
import sqlite3
from auth import DB

c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
print("Database file:", DB)
for t in ("users", "plans", "checkins", "feedback"):
    rows = c.execute(f"SELECT * FROM {t}").fetchall()
    print(f"\n== {t} ({len(rows)} rows) ==")
    for r in rows[:8]:
        d = dict(r)
        for k in ("hash", "salt", "data"):
            if k in d and d[k]:
                d[k] = str(d[k])[:18] + "..."
        print(" ", d)
