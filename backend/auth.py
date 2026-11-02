"""Accounts: sqlite3 + PBKDF2 password hashing + signed tokens (standard library only)."""
import base64, hashlib, hmac, json, os, re, secrets, sqlite3, time
from pathlib import Path

DB = os.environ.get("RUPEEPLATE_DB") or str(Path(__file__).with_name("rupeeplate.db"))
_sf = Path(__file__).with_name(".secret")
if os.environ.get("RUPEEPLATE_SECRET"):
    SECRET = os.environ["RUPEEPLATE_SECRET"].encode()
else:
    if not _sf.exists():
        _sf.write_text(secrets.token_hex(32))
    SECRET = _sf.read_text().strip().encode()


def db():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.executescript("""CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE, salt TEXT, hash TEXT);
    CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY, user_id INTEGER, created TEXT, data TEXT);
    CREATE TABLE IF NOT EXISTS checkins(id INTEGER PRIMARY KEY, user_id INTEGER, day TEXT, weight_kg REAL, waist_cm REAL,
        workouts_done INTEGER, meal_days INTEGER, energy INTEGER, hunger INTEGER, unwell INTEGER, notes TEXT);
    CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, email TEXT, rating INTEGER, message TEXT, created TEXT);""")
    for ddl in ("ALTER TABLE plans ADD COLUMN created_iso TEXT", "ALTER TABLE users ADD COLUMN full_name TEXT",
                "ALTER TABLE users ADD COLUMN gender TEXT", "ALTER TABLE users ADD COLUMN dob TEXT",
                "ALTER TABLE users ADD COLUMN height_cm REAL", "ALTER TABLE users ADD COLUMN weight_kg REAL",
                "ALTER TABLE users ADD COLUMN activity TEXT", "ALTER TABLE users ADD COLUMN goal TEXT"):
        try:
            c.execute(ddl)
        except sqlite3.OperationalError:
            pass
    return c


def _hash(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 200_000).hex()


def valid_email(e):
    return bool(re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}", e or "")) and len(e) <= 100


def create_user(email, pw, name="", p=None):
    """p = profile dict: gender, dob, height_cm, weight_kg, activity, goal."""
    p = p or {}
    salt = secrets.token_hex(16)
    with db() as c:
        cur = c.execute("INSERT INTO users(email,salt,hash,full_name,gender,dob,height_cm,weight_kg,activity,goal) VALUES(?,?,?,?,?,?,?,?,?,?)",
                        (email.lower(), salt, _hash(pw, salt), name, p.get("gender"), p.get("dob"), p.get("height_cm"),
                         p.get("weight_kg"), p.get("activity"), p.get("goal")))
        return cur.lastrowid


def set_weight(uid, kg):
    """Keep the account's current weight up to date when the user logs a check-in."""
    with db() as c:
        c.execute("UPDATE users SET weight_kg=? WHERE id=?", (kg, uid))


def user_row(uid):
    with db() as c:
        r = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return {"email": r["email"], "name": r["full_name"] or "", "gender": r["gender"], "dob": r["dob"], "height_cm": r["height_cm"],
            "weight_kg": r["weight_kg"], "activity": r["activity"], "goal": r["goal"]}


def check_login(email, pw):
    with db() as c:
        r = c.execute("SELECT * FROM users WHERE email=?", (email.lower(),)).fetchone()
    if r and hmac.compare_digest(r["hash"], _hash(pw, r["salt"])):
        return r["id"]
    return None


def make_token(uid):
    body = base64.urlsafe_b64encode(json.dumps({"uid": uid, "exp": time.time() + 7 * 86400}).encode()).decode()
    return body + "." + hmac.new(SECRET, body.encode(), "sha256").hexdigest()


def read_token(tok):
    try:
        body, sig = tok.split(".")
        if not hmac.compare_digest(sig, hmac.new(SECRET, body.encode(), "sha256").hexdigest()):
            return None
        data = json.loads(base64.urlsafe_b64decode(body))
        return data["uid"] if data["exp"] > time.time() else None
    except Exception:
        return None
