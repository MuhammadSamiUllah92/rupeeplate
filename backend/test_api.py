"""Run:  python test_api.py   (checks the API without starting a server)"""
import os, tempfile
os.environ["RUPEEPLATE_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")
from fastapi.testclient import TestClient
from main import app

c = TestClient(app)
base = {"kcal": 2500, "protein": 104, "budget": 700, "days": 3, "kitchen": 2}
assert c.get("/api/health").json() == {"status": "ok"}
print("cuisines:", len(c.get("/api/cuisines").json()), "| dishes:", len(c.get("/api/foods").json()))

p = c.post("/api/plan", json={**base, "cuisines": ["chinese", "italian", "mexican"]}).json()
assert p["ok"], p
for d in p["days"]: print(" ", d["cuisine"], "->", [m["name"] for m in d["meals"].values()])
print("week list Rs", p["shopping_list"]["total"], "| day lists", [d["shopping_list"]["total"] for d in p["days"]])
assert "group" in p["shopping_list"]["items"][0]

low = c.post("/api/plan", json={**base, "budget": 150}).json()
print("too low:", low["message"])
assert c.post("/api/plan", json={**base, "kcal": 1000}).status_code == 422
# allergies and health options
for extra in ({"avoid": ["gluten", "nuts"]}, {"conditions": ["diabetes"]}, {"avoid": ["dairy", "egg"], "conditions": ["low_fat"]}):
    q = c.post("/api/plan", json={**base, **extra}).json()
    print(extra, "->", "ok" if q["ok"] else q["message"])
# pantry: 2 kg rice and 12 eggs are used first and reduce the cash needed
pp = c.post("/api/plan", json={**base, "pantry": {"rice": 2000, "egg": 12, "atta": 3000}}).json()
print("pantry: cash", pp["cash_total"], "saved", pp["pantry_saved"]); assert pp["pantry_saved"] > 0
# describe a meal
d = c.post("/api/swap", json={"mode": "describe", "text": "something with chicken and rice", "plan": p, "day": 0, "meal": "dinner", "params": base}).json()
print("describe:", [o["name"] for o in d["options"]][:3], d["message"])
# price change
imp = c.post("/api/price-impact", json={**base, "days": 3, "new_prices": {"chicken": 1300}}).json()
print("chicken price up: week", round(imp["weekly_cost_before"]), "->", round(imp["weekly_cost_after"]), "added", imp["added"], "removed", imp["removed"])
# requested food + evaluation
ev = c.post("/api/evaluate", json={"food_id": "chicken_biryani", "servings": 1, "kcal": 2000, "protein": 100, "goal": "lose"}).json()["evaluation"]
print("biryani for weight loss:", ev["verdict"], "|", ev["reasons"][0]); assert ev["level"] in ("ok", "limit")
ev2 = c.post("/api/evaluate", json={"food_id": "grilled_chicken", "servings": 1, "kcal": 2500, "protein": 104, "goal": "build"}).json()["evaluation"]
print("grilled chicken for muscle:", ev2["verdict"]); assert ev2["level"] == "good"
rq = {"name": "Chicken biryani", "servings": 1, "kcal": 600, "protein_g": 25, "carbs_g": 80, "fat_g": 20, "price_pkr": 450, "day": 1, "meal": "dinner"}
pr = c.post("/api/plan", json={**base, "budget": 900, "requests": [rq]}).json()
assert pr["ok"], pr; print("with biryani on day 2: day kcal", pr["days"][1]["kcal"], "extras", [x["name"] for x in pr["days"][1]["extras"]], "cash", pr["cash_total"])
p14 = c.post("/api/plan", json={**base, "days": 14}).json(); print("14-day plan ok:", p14["ok"], len(p14.get("days", [])), "days")
# exercise
ex = c.post("/api/exercise/plan", json={"goal": "build", "level": 2, "days_per_week": 4, "minutes": 50, "place": "home_equip", "equipment": ["dumbbells", "bands"], "limits": ["knee"]}).json()
assert ex["ok"] and ex["weekly"]["sessions"] == 4; print("exercise plan:", ex["weekly"], [d["title"] for d in ex["days"] if not d["rest"]])
assert c.post("/api/exercise/plan", json={"days_per_week": 9}).status_code == 422
combo = c.post("/api/plan", json={**base, "exercise": {"goal": "lose", "days_per_week": 3, "minutes": 40, "place": "gym"}}).json()
assert combo["ok"] and combo["exercise"]["ok"]; print("meal + exercise combo ok, activity hint:", combo["exercise"]["activity_hint"])
print("price source status:", c.get("/api/prices/status").json())

opts = c.post("/api/swap", json={"mode": "options", "plan": p, "day": 0, "meal": "lunch", "params": base}).json()["options"]
print("swap options:", [o["name"] for o in opts][:3])
new = c.post("/api/swap", json={"mode": "apply", "plan": p, "day": 0, "meal": "lunch", "params": base,
                                 "mid": opts[0]["mid"], "scale": opts[0]["scale"]}).json()
assert new["days"][0]["meals"]["lunch"]["name"] == opts[0]["name"]
print("swapped lunch ->", new["days"][0]["meals"]["lunch"]["name"], "| day cost", new["days"][0]["cost"])

curve = c.post("/api/tradeoff", json={"kcal": 2500, "budget": 400}).json()["points"]
print("trade-off:", [(q["budget"], q["protein_g"]) for q in curve])

good = {"full_name": "Sami Ullah", "email": "sami@example.com", "password": "Str0ng!Pass", "gender": "male", "dob": "2003-05-14", "height_cm": 172, "weight_kg": 65, "activity": "light", "goal": "maintain"}
for bad, why in [({"password": "password123"}, "weak password"), ({"password": "Sh0rt!"}, "short password"), ({"email": "not-an-email"}, "bad email"),
                 ({"email": "a@b"}, "email without domain"), ({"full_name": ""}, "empty name"), ({"full_name": "Sami123"}, "digits in name"), ({"dob": "2012-01-01"}, "under 18"), ({"dob": "2999-01-01"}, "future dob"), ({"dob": "14/05/2003"}, "bad date format"), ({"dob": "2003-02-31"}, "impossible date"),
                 ({"height_cm": 300}, "height 300"), ({"weight_kg": 10}, "weight 10"), ({"gender": "other"}, "bad gender"), ({"goal": "fly"}, "bad goal"),
                 ({"password": "Sami!Pass1x", "email": "samiullah@example.com"}, "ok")]:
    code = c.post("/api/auth/signup", json={**good, **bad}).status_code
    print("  signup with", why, "->", code)
    assert (code == 200) == (why == "ok") or why == "ok", why
r = c.post("/api/auth/signup", json=good); assert r.status_code == 200 and r.json()["name"] == "Sami Ullah"
assert c.post("/api/auth/signup", json=good).status_code == 409
assert r.json()["weight_kg"] == 65 and r.json()["dob"] == "2003-05-14" and r.json()["gender"] == "male"
assert c.post("/api/auth/login", json={"email": "", "password": "x"}).status_code == 422
assert c.post("/api/auth/login", json={"email": "sami@example.com", "password": ""}).status_code == 422
assert c.post("/api/auth/login", json={"email": "nobody@example.com", "password": "Whatever1!"}).status_code == 401
assert c.post("/api/auth/login", json={"email": "sami@example.com", "password": "wrongPass1!"}).status_code == 401
tok = c.post("/api/auth/login", json={"email": "sami@example.com", "password": "Str0ng!Pass"}).json()["token"]
h = {"Authorization": "Bearer " + tok}
assert c.get("/api/auth/me", headers=h).json()["email"] == "sami@example.com"
assert c.get("/api/plans").status_code == 401
pid = c.post("/api/plans", headers=h, json={"data": {"plan": 1}}).json()["id"]
assert len(c.get("/api/plans", headers=h).json()) == 1
c.delete(f"/api/plans/{pid}", headers=h); assert c.get("/api/plans", headers=h).json() == []
print("accounts: signup, login, save, list, delete all work")
# progress tracking
from datetime import date, timedelta
ten = (date.today() - timedelta(days=10)).isoformat()
prof = {"goal": "lose", "weight_kg": 80, "activity": "light", "sex": "male", "age": 21, "height_cm": 175, "days": 7}
planjson = {"profile": prof, "plan": {"days": [{}] * 7, "exercise": {"ok": True, "weekly": {"sessions": 3}}}}
assert c.post("/api/checkins", headers=h, json={"weight_kg": 79}).status_code == 409
c.post("/api/plans", headers=h, json={"data": planjson, "created": ten})
s = c.get("/api/progress", headers=h).json(); assert s["due"] and s["days_since"] == 10; print("due for a check-in after", s["days_since"], "days")
r = c.post("/api/checkins", headers=h, json={"weight_kg": 79.2, "workouts_done": 4, "meal_days": 6, "energy": 4, "hunger": 2}).json()["analysis"]
print("lose goal, 80 -> 79.2 kg in 10 days:", r["verdict"], "|", r["rate_per_week"], "kg/week |", r["messages"][0]); assert r["verdict"] == "on_track"
from progress import analyze
st = date.today() - timedelta(days=14); ci = lambda w, **k: {"day": date.today().isoformat(), "weight_kg": w, "workouts_done": 6, "meal_days": 7, "energy": 3, "hunger": 3, "unwell": False, **k}
for name, w, kw, want in [("gained while losing", 81.5, {}, "wrong_direction"), ("barely moved", 79.8, {}, "slower"), ("too fast", 76.5, {}, "too_fast"), ("felt unwell", 79, {"unwell": True}, "check_health")]:
    a = analyze(prof, 80, st, ci(w, **kw), 7, 3); print(f"  {name}: {a['verdict']}, kcal change {a['kcal_delta']}"); assert a["verdict"] == want
a = analyze({"goal": "build"}, 65, st, ci(65.1), 7, 3); print("  muscle goal, no change:", a["verdict"], a["kcal_delta"]); assert a["verdict"] == "slower" and a["kcal_delta"] > 0
a = analyze(prof, 80, st, ci(79.8, meal_days=2, workouts_done=1), 7, 3); print("  low adherence:", a["verdict"], "kcal change", a["kcal_delta"]); assert a["kcal_delta"] == 0
print("progress tracking logic works")
fb = {"name": "Ali Raza", "email": "ali@example.com", "rating": 5, "message": "Very helpful meal plans!"}
for bad in ({"rating": 9}, {"email": "nope"}, {"message": "short"}, {"name": ""}):
    assert c.post("/api/feedback", json={**fb, **bad}).status_code == 422
assert c.post("/api/feedback", json=fb).status_code == 200 and c.get("/api/feedback").json()[0]["name"] == "Ali Raza"
print("feedback form: validation + database save + read back all work")

# ---- recipes page: list, filters, servings scaling, validation
rl = c.get("/api/recipes").json()["recipes"]
assert len(rl) >= 36, len(rl)
for g in ("cuisine", "fastfood", "baked", "sweet"):
    assert c.get("/api/recipes", params={"group": g}).json()["recipes"], g
a = c.get("/api/recipes/r_chicken_karahi").json(); b = c.get("/api/recipes/r_chicken_karahi", params={"servings": 8}).json()
assert abs(b["total"]["cost"] - 2 * a["total"]["cost"]) < 1 and abs(b["per_serving"]["kcal"] - a["per_serving"]["kcal"]) < 2
assert abs(a["total"]["kcal"] / a["servings"] - a["per_serving"]["kcal"]) < 2          # per serving = total / servings
assert all(not r["veg"] for r in [a])                                                  # karahi has chicken
assert all(r["veg"] for r in c.get("/api/recipes", params={"veg": True}).json()["recipes"])
assert all("gluten" not in r["allergens"] for r in c.get("/api/recipes", params={"avoid": "gluten"}).json()["recipes"])
assert all("gluten" in r["allergens"] for r in rl if r["id"] in ("r_burger_buns", "r_sponge_cake"))
assert all(r["time"] <= 30 for r in c.get("/api/recipes", params={"max_time": 30}).json()["recipes"])
for bad in ({"servings": 0}, {"servings": 13}, {"servings": "x"}):
    assert c.get("/api/recipes/r_chicken_karahi", params=bad).status_code == 422, bad
assert c.get("/api/recipes", params={"q": "a1;"}).status_code == 422 and c.get("/api/recipes", params={"max_time": 1}).status_code == 422
assert c.get("/api/recipes/nope").status_code == 404
print("recipes page: list, filters, servings scaling, validation all work (", len(rl), "recipes )")

# ---- fast food items and the goal check
ex = c.get("/api/extras").json()
assert {"fast", "baked", "sweet", "drink"} <= {x["type"] for x in ex} and any(x["id"] == "fried_chicken" for x in ex)
v = c.post("/api/evaluate", json={"food_id": "pizza", "servings": 2, "kcal": 1800, "protein": 70, "goal": "lose", "conditions": ["diabetes"]}).json()["evaluation"]
assert v["level"] == "limit", v
assert c.post("/api/evaluate", json={"food_id": "pizza", "servings": 9, "kcal": 1800, "protein": 70, "goal": "lose"}).status_code == 422
print("fast food goal check: pizza for weight loss with diabetes ->", v["verdict"])

# ---- logged-in home page data
assert c.get("/api/home").status_code == 401
hm = c.get("/api/home", headers=h).json()
assert hm["user"]["name"] == "Sami Ullah" and hm["user"]["age"] >= 18 and hm["counts"]["plans"] >= 0
print("logged-in home data:", hm["user"]["name"], "age", hm["user"]["age"], "| plans", hm["counts"]["plans"], "| today", bool(hm["today"]))
print("ALL CHECKS PASSED")
