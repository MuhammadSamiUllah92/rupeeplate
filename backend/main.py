"""RupeePlate API.  Run:  uvicorn main:app --reload
Open http://127.0.0.1:8000/docs to try every endpoint in the browser."""
import json
import sqlite3
from datetime import date
from typing import Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import re

from pydantic import BaseModel, Field, field_validator

import auth
import engine
import exercise
import prices
import progress
import recipes
from targets import KCAL_FLOOR, NOTICE, calc_targets

app = FastAPI(title="RupeePlate API", version="0.5")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])
Avoid = List[Literal["beef", "fish", "egg", "chicken", "dairy", "gluten", "nuts", "soy"]]
Conds = List[Literal["diabetes", "low_fat"]]


class TargetsIn(BaseModel):
    age: int = Field(ge=18, le=80)
    sex: Literal["male", "female"]
    height_cm: float = Field(ge=130, le=220)
    weight_kg: float = Field(ge=35, le=200)
    activity: Literal["low", "light", "moderate", "high", "athlete"] = "light"
    goal: Literal["maintain", "lose", "lose_fast", "build", "gain", "active"] = "maintain"


class ExerciseIn(BaseModel):
    goal: Literal["build", "lose", "endurance", "general"] = "general"
    level: int = Field(default=1, ge=1, le=3)
    days_per_week: int = Field(default=3, ge=2, le=6)
    minutes: int = Field(default=45, ge=20, le=90)
    place: Literal["home_none", "home_equip", "gym"] = "home_none"
    equipment: List[Literal["dumbbells", "bands", "pullup_bar", "bench", "jump_rope"]] = []
    limits: List[Literal["knee", "back", "shoulder", "low_impact"]] = []
    weight_kg: float = Field(default=65, ge=35, le=200)


class Req(BaseModel):
    name: str = Field(max_length=60)
    servings: float = Field(gt=0, le=6)
    kcal: float = Field(ge=0, le=3000)
    protein_g: float = Field(ge=0, le=300)
    carbs_g: float = Field(ge=0, le=500)
    fat_g: float = Field(ge=0, le=300)
    price_pkr: float = Field(ge=0, le=20000)
    day: int = Field(ge=0, le=13)
    meal: Literal["breakfast", "lunch", "dinner", "snack"]


class FoodIn(BaseModel):
    food_id: Optional[str] = None
    custom: Optional[dict] = None
    servings: float = Field(default=1, gt=0, le=6)
    kcal: int = Field(ge=KCAL_FLOOR, le=4500)
    protein: int = Field(ge=20, le=250)
    goal: Literal["maintain", "lose", "lose_fast", "build", "gain", "active"] = "maintain"
    conditions: Conds = []


class PlanIn(BaseModel):
    kcal: int = Field(ge=KCAL_FLOOR, le=4500, description="Daily calories (minimum 1,400)")
    protein: int = Field(ge=20, le=250)
    budget: int = Field(ge=100, le=5000, description="Daily budget in rupees")
    days: int = Field(default=7, ge=1, le=14)
    kitchen: int = Field(default=2, ge=0, le=2, description="0 none, 1 kettle/microwave, 2 full")
    vegetarian: bool = False
    avoid: Avoid = []
    conditions: Conds = []
    cuisines: List[str] = []
    pantry: Dict[str, float] = {}
    requests: List[Req] = []
    exercise: Optional[ExerciseIn] = None
    price_overrides: Dict[str, float] = {}


class CurveIn(BaseModel):
    kcal: int = Field(ge=KCAL_FLOOR, le=4500)
    budget: int = Field(ge=100, le=5000)
    kitchen: int = Field(default=2, ge=0, le=2)
    vegetarian: bool = False
    avoid: Avoid = []
    conditions: Conds = []
    price_overrides: Dict[str, float] = {}


class ImpactIn(PlanIn):
    new_prices: Dict[str, float] = Field(min_length=1)


class SwapIn(BaseModel):
    mode: Literal["options", "describe", "apply"]
    text: str = Field(default="", max_length=200)
    plan: dict
    day: int = Field(ge=0, le=13)
    meal: Literal["breakfast", "lunch", "dinner", "snack"]
    params: PlanIn
    mid: Optional[str] = None
    scale: Optional[float] = None


class LoginIn(BaseModel):
    email: str = Field(max_length=100)
    password: str = Field(min_length=1, max_length=100)


def age_from(dob: date) -> int:
    t = date.today()
    return t.year - dob.year - ((t.month, t.day) < (dob.month, dob.day))


class SignupIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=60)
    email: str = Field(max_length=100)
    password: str = Field(min_length=8, max_length=100)
    gender: Literal["male", "female"]
    dob: str
    height_cm: float = Field(ge=130, le=220)
    weight_kg: float = Field(ge=35, le=200)
    activity: Literal["low", "light", "moderate", "high", "athlete"]
    goal: Literal["maintain", "lose", "lose_fast", "build", "gain", "active"]

    @field_validator("dob")
    @classmethod
    def _dob(cls, v):
        try:
            d = date.fromisoformat(v)
        except ValueError:
            raise ValueError("Date of birth must be a real date in YYYY-MM-DD format.")
        if d > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        if not 18 <= age_from(d) <= 80:
            raise ValueError("You must be between 18 and 80 years old to use RupeePlate.")
        return v

    @field_validator("full_name")
    @classmethod
    def _name(cls, v):
        v = v.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,59}", v):
            raise ValueError("Name can only contain letters, spaces, dots, apostrophes and hyphens.")
        return v

    @field_validator("password")
    @classmethod
    def _strong(cls, v):
        checks = [(r".{8,}", "at least 8 characters"), (r"[A-Z]", "an uppercase letter"), (r"[a-z]", "a lowercase letter"),
                  (r"\d", "a number"), (r"[^A-Za-z0-9\s]", "a symbol such as ! @ # $")]
        missing = [t for p, t in checks if not re.search(p, v)]
        if re.search(r"\s", v):
            missing.append("no spaces")
        if missing:
            raise ValueError("Password needs " + ", ".join(missing) + ".")
        return v


class SaveIn(BaseModel):
    data: dict
    created: Optional[str] = None


class FeedbackIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(max_length=100)
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=10, max_length=500)

    @field_validator("name")
    @classmethod
    def _n(cls, v):
        v = v.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,59}", v):
            raise ValueError("Name can only contain letters, spaces, dots, apostrophes and hyphens.")
        return v

    @field_validator("message")
    @classmethod
    def _m(cls, v):
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Please write at least 10 characters.")
        return v


class CheckInIn(BaseModel):
    weight_kg: float = Field(ge=30, le=250)
    waist_cm: Optional[float] = Field(default=None, ge=40, le=200)
    workouts_done: int = Field(default=0, ge=0, le=80)
    meal_days: int = Field(default=0, ge=0, le=14)
    energy: int = Field(default=3, ge=1, le=5)
    hunger: int = Field(default=3, ge=1, le=5)
    unwell: bool = False
    notes: str = Field(default="", max_length=300)
    date: Optional[str] = None


def _foods(o):
    return engine.load_foods(price_overrides=o or None)


def user_id(authorization: Optional[str] = Header(None)):
    uid = auth.read_token(authorization.split(" ")[-1]) if authorization else None
    if not uid:
        raise HTTPException(401, "Please log in.")
    return uid


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/cuisines")
def cuisines():
    return [{"id": k, "name": v} for k, v in engine.CUISINES.items()]


@app.get("/api/ingredients")
def ingredients():
    return list(engine.load_ingredients().values())


@app.get("/api/foods")
def foods():
    return [{k: f[k] for k in ("id", "name", "category", "serving", "kcal", "protein_g", "price_pkr",
                               "kitchen", "veg", "time_min", "ing_text", "steps")} for f in engine.load_foods()]


@app.post("/api/targets")
def targets(body: TargetsIn):
    return calc_targets(**body.model_dump())


@app.post("/api/plan")
def plan(body: PlanIn):
    ings = engine.load_ingredients(body.price_overrides or None)
    p = engine.make_plan(body.kcal, body.protein, body.budget, body.days, body.kitchen, body.vegetarian,
                         body.avoid, body.cuisines, _foods(body.price_overrides), body.conditions,
                         body.pantry, ings, [r.model_dump() for r in body.requests])
    if p["ok"]:
        engine.attach_shopping(p, ings, body.pantry)
    p["notice"] = NOTICE
    if p["ok"] and body.exercise:
        p["exercise"] = exercise.build_plan(**body.exercise.model_dump())
    return p


@app.post("/api/exercise/plan")
def exercise_plan(body: ExerciseIn):
    r = exercise.build_plan(**body.model_dump())
    if not r["ok"]:
        raise HTTPException(422, r["message"])
    return r


@app.post("/api/swap")
def swap(body: SwapIn):
    q = body.params
    if body.day >= len(body.plan.get("days", [])):
        raise HTTPException(422, "No such day in this plan.")
    f = _foods(q.price_overrides)
    args = (body.plan, body.day, body.meal)
    if body.mode == "options":
        return {"options": engine.swap_options(*args, q.kcal, q.protein, q.budget, q.kitchen, q.vegetarian,
                                               q.avoid, foods=f, conditions=q.conditions)}
    if body.mode == "describe":
        opts, msg = engine.describe_options(*args, body.text, q.kcal, q.protein, q.budget, q.kitchen,
                                            q.vegetarian, q.avoid, foods=f, conditions=q.conditions)
        return {"options": opts, "message": msg}
    try:
        p = engine.apply_swap(*args, body.mid, body.scale, q.kitchen, q.vegetarian, q.avoid, foods=f,
                              conditions=q.conditions)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return engine.attach_shopping(p, engine.load_ingredients(q.price_overrides or None), q.pantry)


@app.post("/api/tradeoff")
def tradeoff(body: CurveIn):
    return {"points": engine.tradeoff_curve(body.kcal, body.budget, body.kitchen, body.vegetarian,
                                            body.avoid, foods=_foods(body.price_overrides), conditions=body.conditions)}


@app.post("/api/price-impact")
def price_impact(body: ImpactIn):
    return engine.price_impact(body.kcal, body.protein, body.budget, body.new_prices, body.days, body.kitchen,
                               body.vegetarian, body.avoid, body.cuisines, body.conditions, body.pantry,
                               body.price_overrides, [r.model_dump() for r in body.requests])


# ---- recipes (open to guests and logged-in users)
Allergy = Literal["beef", "fish", "egg", "chicken", "dairy", "gluten", "nuts", "soy"]


@app.get("/api/recipes")
def recipe_list(group: Optional[Literal["cuisine", "fastfood", "baked", "sweet"]] = None,
                cuisine: Optional[Literal["punjabi", "sindhi", "pashtun", "desi", "chinese", "italian", "western", "mexican", "mideast", "light"]] = None,
                q: str = Query("", max_length=40, pattern=r"^[A-Za-z ]*$"), veg: bool = False,
                avoid: List[Allergy] = Query([]), max_time: Optional[int] = Query(None, ge=5, le=240)):
    return {"groups": recipes.GROUPS, "cuisines": engine.CUISINES, "recipes": recipes.search(group, cuisine, q.strip(), veg, avoid, max_time)}


@app.get("/api/recipes/{rid}")
def recipe_one(rid: str, servings: Optional[int] = Query(None, ge=1, le=12)):
    r = recipes.one(rid, servings)
    if not r:
        raise HTTPException(404, "Recipe not found.")
    return r


@app.get("/api/home")
def home(uid: int = Depends(user_id)):
    """Data for the logged-in home page."""
    u = auth.user_row(uid)
    st = progress.state(uid)
    with auth.db() as c:
        plans = c.execute("SELECT COUNT(*) n FROM plans WHERE user_id=?", (uid,)).fetchone()["n"]
        checks = c.execute("SELECT COUNT(*) n FROM checkins WHERE user_id=?", (uid,)).fetchone()["n"]
    age = age_from(date.fromisoformat(u["dob"])) if u.get("dob") else None
    weights = [e["weight_kg"] for e in st["entries"]]
    return {"user": {**u, "age": age}, "today": progress.today_view(uid), "due": st["due"], "days_since": st["days_since"],
            "counts": {"plans": plans, "checkins": checks}, "latest_weight": weights[-1] if weights else u.get("weight_kg"),
            "start_weight": weights[0] if weights else u.get("weight_kg")}


@app.get("/api/extras")
def extras():
    return engine.load_extras()


@app.post("/api/evaluate")
def evaluate(body: FoodIn):
    if body.custom:
        c = body.custom
        try:
            food = {"name": str(c.get("name") or "Your food")[:60], "serving": str(c.get("serving", "1 serving"))[:40],
                    "kcal": float(c["kcal"]), "protein_g": float(c.get("protein_g", 0)), "carbs_g": float(c.get("carbs_g", 0)),
                    "fat_g": float(c.get("fat_g", 0)), "price_pkr": float(c.get("price_pkr", 0)), "sugary": bool(c.get("sugary"))}
        except (KeyError, ValueError, TypeError):
            raise HTTPException(422, "Please enter at least the calories as a number.")
    else:
        food = next((x for x in engine.load_extras() if x["id"] == body.food_id), None)
        if not food:
            raise HTTPException(404, "Food not found.")
    return {"food": food, "evaluation": engine.evaluate_food(food, body.servings, body.kcal, body.protein, body.goal, body.conditions)}


@app.get("/api/prices/status")
def prices_status():
    return prices.status()


@app.post("/api/prices/refresh")
def prices_refresh():
    try:
        r = prices.update()
    except Exception as e:
        raise HTTPException(502, str(e))
    return {k: r[k] for k in ("updated", "source", "count")}


# ---- accounts and saved plans
@app.post("/api/auth/signup")
def signup(body: SignupIn):
    if not auth.valid_email(body.email):
        raise HTTPException(422, "Please enter a valid email address, like name@example.com.")
    if body.email.split("@")[0].lower() in body.password.lower() and len(body.email.split("@")[0]) >= 4:
        raise HTTPException(422, "Your password should not contain your email name.")
    try:
        uid = auth.create_user(body.email, body.password, body.full_name, body.model_dump())
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists. Try logging in.")
    return {"token": auth.make_token(uid), **auth.user_row(uid)}


@app.post("/api/auth/login")
def login(body: LoginIn):
    body.email = body.email.strip()
    if not auth.valid_email(body.email):
        raise HTTPException(422, "Please enter a valid email address.")
    uid = auth.check_login(body.email, body.password)
    if not uid:
        raise HTTPException(401, "Email or password is not right.")
    return {"token": auth.make_token(uid), **auth.user_row(uid)}


@app.get("/api/auth/me")
def me(uid: int = Depends(user_id)):
    return auth.user_row(uid)


@app.get("/api/plans")
def list_plans(uid: int = Depends(user_id)):
    with auth.db() as c:
        rows = c.execute("SELECT * FROM plans WHERE user_id=? ORDER BY id DESC", (uid,)).fetchall()
    return [{"id": r["id"], "date": r["created"], "res": json.loads(r["data"])} for r in rows]


@app.post("/api/plans")
def save_plan(body: SaveIn, uid: int = Depends(user_id)):
    with auth.db() as c:
        day = date.today()
        if body.created:
            try:
                day = date.fromisoformat(body.created)
            except ValueError:
                raise HTTPException(422, "Bad date.")
            if day > date.today():
                raise HTTPException(422, "The date cannot be in the future.")
        cur = c.execute("INSERT INTO plans(user_id,created,created_iso,data) VALUES(?,?,?,?)",
                        (uid, day.strftime("%d/%m/%Y"), day.isoformat(), json.dumps(body.data)))
    return {"id": cur.lastrowid}


@app.delete("/api/plans/{pid}")
def delete_plan(pid: int, uid: int = Depends(user_id)):
    with auth.db() as c:
        c.execute("DELETE FROM plans WHERE id=? AND user_id=?", (pid, uid))
    return {"ok": True}


@app.get("/api/progress")
def get_progress(uid: int = Depends(user_id)):
    return progress.state(uid)


@app.post("/api/checkins")
def post_checkin(body: CheckInIn, uid: int = Depends(user_id)):
    b = body.model_dump()
    if b["date"]:
        try:
            if date.fromisoformat(b["date"]) > date.today():
                raise HTTPException(422, "The date cannot be in the future.")
        except ValueError:
            raise HTTPException(422, "Bad date.")
    if not progress.latest_plan(uid):
        raise HTTPException(409, "Make a meal plan while logged in first, so there is something to track.")
    auth.set_weight(uid, b["weight_kg"])
    return progress.add_checkin(uid, b)


@app.post("/api/feedback")
def post_feedback(body: FeedbackIn, authorization: Optional[str] = Header(None)):
    if not auth.valid_email(body.email):
        raise HTTPException(422, "Please enter a valid email address.")
    uid = auth.read_token(authorization.split(" ")[-1]) if authorization else None
    with auth.db() as c:
        c.execute("INSERT INTO feedback(user_id,name,email,rating,message,created) VALUES(?,?,?,?,?,?)",
                  (uid, body.name, body.email.lower(), body.rating, body.message, date.today().strftime("%d/%m/%Y")))
    return {"ok": True}


@app.get("/api/feedback")
def list_feedback():
    with auth.db() as c:
        rows = c.execute("SELECT name, rating, message, created FROM feedback ORDER BY id DESC LIMIT 10").fetchall()
    return [dict(r) for r in rows]


# ---- one-command mode: if the website has been built (npm run build), this same server also serves it.
# Open http://127.0.0.1:8000 and everything (pages + API) runs from one program. In normal development
# you can still run `npm run dev` on port 5173 instead.
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
PUBLIC = DIST.parent / "public"                # photos downloaded by fetch_photos.py are picked up without a rebuild
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def website(path: str):                    # SPA fallback: any page address returns index.html and React Router shows the page
        if path.startswith("api/"):
            raise HTTPException(404, "Not found.")
        for root in (PUBLIC, DIST):
            f = (root / path).resolve()
            if path and f.is_file() and root.resolve() in f.parents:
                return FileResponse(f)
        return FileResponse(DIST / "index.html")
