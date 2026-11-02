"""RupeePlate planning engine.

Builds a weekly meal plan from whole meals (for example "Paratha, omelette and chai").
Each day is a small mixed-integer program (PuLP + CBC solver): pick one meal and portion
size for breakfast, lunch, dinner and snack so that cost is as low as possible while
calories, protein, variety, the day's cuisine and the kitchen limit are all met.
"""
import csv
import json
import math
from pathlib import Path

import pulp

MEALS = ["breakfast", "lunch", "dinner", "snack"]
TYPE = {"B": "breakfast", "L": "lunch", "D": "dinner", "S": "snack"}
SHARE = {"breakfast": (0.18, 0.30), "lunch": (0.28, 0.40), "dinner": (0.25, 0.40), "snack": (0.05, 0.15)}
SCALES = (1, 1.5, 2)                 # portion sizes
DISCRETE = {"egg_boiled", "omelette", "bread", "banana", "apple", "guava", "chana_roast", "peanuts",
            "peanut_butter", "dates", "milk", "dahi", "chai", "oats"}   # whole servings only
VARIETY_PENALTY = 8                  # rupees added per earlier use of a meal this week
MAX_USES = 3                         # a meal may appear at most 3 times in a plan
MEAT = {"chicken", "chicken_boneless", "beef", "mince", "fish"}
AVOID = {"beef": {"beef", "mince"}, "fish": {"fish"}, "egg": {"egg"}, "chicken": {"chicken", "chicken_boneless"},
         "dairy": {"milk", "uht_milk", "dahi", "cheese", "butter"}, "gluten": {"atta", "maida", "bun", "bread", "pasta", "noodles", "tortilla", "oats"},
         "nuts": {"peanuts", "peanut_butter"}, "soy": {"soya", "soy_sauce"}}
CONDITIONS = {"diabetes": {"sugar", "dates"}, "low_fat": set()}   # ingredients left out when the option is on
CUISINES = {"any": "Any", "punjabi": "Punjabi", "sindhi": "Sindhi / Karachi", "pashtun": "Pashtun",
            "desi": "Home-style desi", "chinese": "Chinese", "italian": "Italian",
            "western": "Western / Continental", "mexican": "Mexican",
            "mideast": "Middle Eastern & Mediterranean", "light": "Light and healthy"}
UNIT = {"kg": "g", "l": "ml", "pc": "pc"}
DATA = Path(__file__).with_name("data")


def load_ingredients(price_overrides=None):
    """Ingredient prices: baseline csv, then latest PBS prices (prices_live.json), then the user's edits."""
    ings = {}
    with open(DATA / "ingredients.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            for k in ("price", "kcal", "protein_g", "carbs_g", "fat_g"):
                r[k] = float(r[k])
            ings[r["id"]] = r
    live = DATA / "prices_live.json"
    if live.exists():
        j = json.loads(live.read_text())
        for iid, p in j["prices"].items():
            if iid in ings:
                ings[iid]["price"], ings[iid]["source"] = float(p), f"PBS, updated {j['updated']}"
    for iid, p in (price_overrides or {}).items():
        if iid in ings:
            ings[iid]["price"], ings[iid]["source"] = float(p), "your edit"
    return ings


def _cost(g, amount):
    return g["price"] * amount / 1000 if g["unit"] in ("kg", "l") else g["price"] * amount


def load_foods(price_overrides=None):
    """Dishes. Price and nutrition are added up from ingredients."""
    ings = load_ingredients(price_overrides)
    recipes = json.load(open(DATA / "recipes.json", encoding="utf-8"))
    foods = []
    for rid, r in recipes.items():
        t = {"kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "price_pkr": 0}
        text = []
        for iid, amt in r["ing"].items():
            g = ings[iid]
            k = amt / 100 if g["unit"] in ("kg", "l") else amt
            for n in ("kcal", "protein_g", "carbs_g", "fat_g"):
                t[n] += g[n] * k
            t["price_pkr"] += _cost(g, amt)
            text.append(f"{amt:g} {UNIT[g['unit']]} {g['name']}")
        foods.append({"id": rid, "name": r["name"], "category": r["cat"], "serving": r["serve"],
                      "kitchen": r["k"], "veg": r["veg"], "time_min": r["time"], "steps": r["steps"],
                      "ing": r["ing"], "ing_text": text, **{n: round(v, 1) for n, v in t.items()}})
    return foods


def _unit_cost(g):
    return g["price"] / 1000 if g["unit"] in ("kg", "l") else g["price"]


def build_candidates(foods, kitchen=2, vegetarian=False, avoid=(), conditions=()):
    """Every allowed meal in every portion size, with its total cost and nutrition."""
    by = {f["id"]: f for f in foods}
    meals = json.load(open(DATA / "meals.json", encoding="utf-8"))
    skip = set().union(*[CONDITIONS[c] for c in conditions]) if conditions else set()
    out = []
    for mid, m in meals.items():
        comps = [by[d] for d in m["items"]]
        if max(c["kitchen"] for c in comps) > kitchen:
            continue
        ings = set().union(*[set(c["ing"]) for c in comps])
        if (vegetarian and ings & MEAT) or any(ings & AVOID[a] for a in avoid) or ings & skip:
            continue
        seen = set()
        for s in SCALES:
            items = []
            for d, base in m["items"].items():
                q = base * s
                q = max(1, round(q)) if d in DISCRETE else max(0.5, round(q * 2) / 2)
                items.append((by[d], q))
            key = tuple((f["id"], q) for f, q in items)
            if key in seen:
                continue
            seen.add(key)
            tot = lambda fld: sum(f[fld] * q for f, q in items)
            need = {}
            for f, q in items:
                for iid, amt in f["ing"].items():
                    need[iid] = need.get(iid, 0) + amt * q
            out.append({"mid": mid, "name": m["name"], "types": [TYPE[c] for c in m["t"]],
                        "cuisines": m["c"], "scale": s, "items": items, "kcal": tot("kcal"),
                        "protein": tot("protein_g"), "fat": tot("fat_g"), "carbs": tot("carbs_g"),
                        "cost": tot("price_pkr"), "need": need,
                        "time": max(f["time_min"] for f, _ in items)})
    return out


def _eff(c, stock, ings):
    """Cash cost of a meal after using what is already in the pantry."""
    if not stock:
        return c["cost"]
    return c["cost"] - sum(min(a, stock.get(i, 0)) * _unit_cost(ings[i]) for i, a in c["need"].items())


def _solve_day(cands, kcal, protein, budget, uses, yesterday, cuisine, mode="plan", loose=False,
               stock=None, ings=None, conditions=(), max_uses=MAX_USES):
    z = {}
    tagged = {ml: any(cuisine in c["cuisines"] and ml in c["types"] for c in cands) for ml in MEALS}
    ec = [_eff(c, stock, ings) for c in cands]
    for i, c in enumerate(cands):
        if uses.get(c["mid"], 0) >= (99 if loose else max_uses):
            continue
        for meal in c["types"]:
            if not loose and c["mid"] == yesterday.get(meal):
                continue
            if cuisine != "any" and meal != "snack" and tagged[meal] and cuisine not in c["cuisines"]:
                continue
            z[(i, meal)] = pulp.LpVariable(f"z_{i}_{meal}", cat="Binary")
    if any(not any(k[1] == meal for k in z) for meal in MEALS):
        return None
    m = pulp.LpProblem("day", pulp.LpMinimize)
    val = lambda i, fld: ec[i] if fld == "cost" else cands[i][fld]
    S = lambda fld, meal=None: pulp.lpSum(val(i, fld) * v for (i, ml), v in z.items() if meal in (None, ml))
    for meal in MEALS:
        m += pulp.lpSum(v for (i, ml), v in z.items() if ml == meal) == 1
        lo, hi = SHARE[meal]
        m += S("kcal", meal) >= lo * kcal
        m += S("kcal", meal) <= hi * kcal
    by_mid = {}
    for (i, ml), v in z.items():
        by_mid.setdefault(cands[i]["mid"], []).append(v)
    for vs in by_mid.values():
        m += pulp.lpSum(vs) <= 1
    m += S("kcal") >= 0.95 * kcal
    m += S("kcal") <= 1.05 * kcal
    m += S("fat") * 9 <= (0.30 if "low_fat" in conditions else 0.40) * S("kcal")
    if "diabetes" in conditions:
        m += S("carbs") * 4 <= 0.50 * S("kcal")      # carbohydrates at most half of the day's calories
    if mode != "protein":
        m += S("protein") >= protein
        m += S("protein") <= 1.6 * protein
    if budget is not None:
        m += S("cost") <= budget
    pen = pulp.lpSum(VARIETY_PENALTY * uses.get(cands[i]["mid"], 0) * v for (i, ml), v in z.items())
    m += (-S("protein") + 0.001 * S("cost")) if mode == "protein" else (S("cost") if mode == "cost" else S("cost") + pen)
    m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=10, gapRel=0.01))
    if pulp.LpStatus[m.status] != "Optimal":
        return None
    return {meal: cands[i] for (i, ml), v in z.items() if v.value() and v.value() > 0.5 for meal in [ml]}


def _meal_out(c):
    items = [{"id": f["id"], "name": f["name"], "servings": q, "serving": f["serving"],
              "cost": q * f["price_pkr"], "kcal": q * f["kcal"], "protein_g": q * f["protein_g"],
              "time_min": f["time_min"], "steps": f["steps"], "ing": f["ing"], "ing_text": f["ing_text"]}
             for f, q in c["items"]]
    return {"mid": c["mid"], "name": c["name"], "portion": c["scale"], "cuisines": c["cuisines"], "items": items,
            "cost": c["cost"], "kcal": round(c["kcal"]), "protein_g": round(c["protein"], 1),
            "carbs_g": round(c["carbs"], 1), "fat_g": round(c["fat"], 1)}


def _day_totals(meals, extras):
    allx = list(meals.values()) + extras
    return {"cost": sum(x["cost"] for x in allx), "kcal": round(sum(x["kcal"] for x in allx)),
            "protein_g": round(sum(x["protein_g"] for x in allx), 1),
            "carbs_g": round(sum(x.get("carbs_g", 0) for x in allx), 1),
            "fat_g": round(sum(x.get("fat_g", 0) for x in allx), 1)}


def _requests(requests):
    out = []
    for r in requests:
        s = r["servings"]
        out.append({"name": r["name"], "servings": s, "day": r["day"], "meal": r["meal"], "cost": r["price_pkr"] * s,
                    "kcal": r["kcal"] * s, "protein_g": r["protein_g"] * s, "carbs_g": r["carbs_g"] * s,
                    "fat_g": r["fat_g"] * s})
    return out


def make_plan(kcal, protein, budget, days=7, kitchen=2, vegetarian=False, avoid=(), cuisines=(), foods=None,
              conditions=(), pantry=None, ings=None, requests=()):
    foods = foods if foods is not None else load_foods()
    cands = build_candidates(foods, kitchen, vegetarian, avoid, conditions)
    stock = dict(pantry or {})
    ings = ings or (load_ingredients() if stock else None)
    reqs = _requests(requests)
    uses, yesterday, out, notes = {}, {}, [], []
    kw = dict(loose=kitchen <= 1, conditions=conditions, max_uses=MAX_USES * math.ceil(days / 7))
    for d in range(days):
        rq = [r for r in reqs if r["day"] == d]
        kd = kcal - sum(r["kcal"] for r in rq)
        pd = max(10, protein - sum(r["protein_g"] for r in rq))
        bd = budget - sum(r["cost"] for r in rq)
        if rq and kd < 0.4 * kcal:
            return {"ok": False, "reason": "request_too_big", "min_daily_budget": None,
                    "message": f"The foods you asked for on day {d + 1} use most of that day's calories. Reduce the servings or move one to another day."}
        if rq and bd < 60:
            return {"ok": False, "reason": "budget_too_low", "min_daily_budget": None,
                    "message": f"The foods you asked for on day {d + 1} use up that day's budget. Raise the budget or move one to another day."}
        cu = cuisines[d] if d < len(cuisines) and cuisines[d] in CUISINES else "any"
        pick = _solve_day(cands, kd, pd, bd, uses, yesterday, cu, stock=stock, ings=ings, **kw)
        if pick is None and cu != "any":
            pick = _solve_day(cands, kd, pd, bd, uses, yesterday, "any", stock=stock, ings=ings, **kw)
            if pick:
                notes.append(f"Day {d + 1}: {CUISINES[cu]} meals did not fit your budget and targets, so we used the closest alternatives.")
        if pick is None:
            low = _solve_day(cands, kd, pd, None, uses, yesterday, "any", "cost", stock=stock, ings=ings, **kw)
            if low:
                need = math.ceil(sum(_eff(c, stock, ings) for c in low.values()) + sum(r["cost"] for r in rq))
                return {"ok": False, "reason": "budget_too_low", "min_daily_budget": need,
                        "message": f"No plan fits Rs {budget:g} a day with these targets, kitchen and food choices. The lowest daily budget that works is about Rs {need}."}
            return {"ok": False, "reason": "infeasible", "min_daily_budget": None,
                    "message": "No plan meets these targets with the meals your kitchen, allergies and diet allow. Try a bigger kitchen option, fewer exclusions or lower targets."}
        meals = {ml: _meal_out(pick[ml]) for ml in MEALS}
        for ml in MEALS:
            uses[pick[ml]["mid"]] = uses.get(pick[ml]["mid"], 0) + 1
            yesterday[ml] = pick[ml]["mid"]
            for iid, a in pick[ml]["need"].items():
                stock[iid] = max(0, stock.get(iid, 0) - a)
        out.append({"day": d + 1, "cuisine": cu, "meals": meals, "extras": rq, **_day_totals(meals, rq)})
    return {"ok": True, "days": out, "notes": notes, "weekly_cost": sum(x["cost"] for x in out),
            "average_daily_cost": sum(x["cost"] for x in out) / days}


def _fmt(g, amt):
    if g["unit"] == "pc":
        return f"{round(amt)} pcs"
    if g["unit"] == "kg":
        return f"{amt / 1000:.2f} kg" if amt >= 1000 else f"{round(amt)} g"
    return f"{amt / 1000:.2f} L" if amt >= 1000 else f"{round(amt)} ml"


def _rows(buy, pant, ings):
    rows = []
    for iid in set(buy) | set(pant):
        g = ings[iid]
        b, p = buy.get(iid, 0), pant.get(iid, 0)
        rows.append({"name": g["name"], "quantity": _fmt(g, b) if b > 0.5 else "In your pantry",
                     "pantry": f"{_fmt(g, p)} from your pantry" if p > 0.5 and b > 0.5 else "",
                     "cost": round(_cost(g, b)), "group": g["group"], "source": g["source"]})
    rows.sort(key=lambda r: (r["group"], -r["cost"]))
    return {"items": rows, "total": sum(r["cost"] for r in rows)}


def attach_shopping(plan, ings, pantry=None):
    """Whole-week list and one list per day, using up the pantry day by day."""
    stock = dict(pantry or {})
    wbuy, wpant = {}, {}
    for d in plan["days"]:
        need = {}
        for meal in d["meals"].values():
            for i in meal["items"]:
                for iid, amt in i["ing"].items():
                    need[iid] = need.get(iid, 0) + amt * i["servings"]
        buy, pant = {}, {}
        for iid, a in need.items():
            use = min(stock.get(iid, 0), a)
            stock[iid] = stock.get(iid, 0) - use
            pant[iid], buy[iid] = use, a - use
            wpant[iid], wbuy[iid] = wpant.get(iid, 0) + use, wbuy.get(iid, 0) + a - use
        d["shopping_list"] = _rows(buy, pant, ings)
        d["cash_cost"] = d["shopping_list"]["total"] + round(sum(x["cost"] for x in d.get("extras", [])))
    plan["shopping_list"] = _rows(wbuy, wpant, ings)
    plan["extras_total"] = round(sum(x["cost"] for d in plan["days"] for x in d.get("extras", [])))
    plan["cash_total"] = plan["shopping_list"]["total"] + plan["extras_total"]
    plan["pantry_saved"] = max(0, round(plan["weekly_cost"] - plan["cash_total"]))
    return plan


def _retotal(plan):
    for d in plan["days"]:
        d.update(_day_totals(d["meals"], d.get("extras", [])))
    plan["weekly_cost"] = sum(d["cost"] for d in plan["days"])
    plan["average_daily_cost"] = plan["weekly_cost"] / len(plan["days"])


def _fits(plan, day, meal, c, kcal, protein, budget):
    rest = [x for m, x in plan["days"][day]["meals"].items() if m != meal] + plan["days"][day].get("extras", [])
    k = sum(x["kcal"] for x in rest) + c["kcal"]
    p = sum(x["protein_g"] for x in rest) + c["protein"]
    cost = sum(x["cost"] for x in rest) + c["cost"]
    return (0.9 * kcal <= k <= 1.1 * kcal and p >= 0.95 * protein and cost <= budget), cost


def _opt(c, dc):
    return {"mid": c["mid"], "scale": c["scale"], "name": c["name"], "cost": round(c["cost"]),
            "kcal": round(c["kcal"]), "protein_g": round(c["protein"]), "day_cost": round(dc)}


def swap_options(plan, day, meal, kcal, protein, budget, kitchen=2, vegetarian=False, avoid=(),
                 foods=None, limit=6, conditions=()):
    foods = foods if foods is not None else load_foods()
    names = {x["name"] for x in plan["days"][day]["meals"].values()}
    best = {}
    for c in build_candidates(foods, kitchen, vegetarian, avoid, conditions):
        if meal not in c["types"] or c["name"] in names:
            continue
        ok, dc = _fits(plan, day, meal, c, kcal, protein, budget)
        if ok and (c["mid"] not in best or abs(c["kcal"] - kcal / 4) < abs(best[c["mid"]][0]["kcal"] - kcal / 4)):
            best[c["mid"]] = (c, dc)
    return [_opt(c, dc) for c, dc in sorted(best.values(), key=lambda t: t[1])[:limit]]


KEYWORDS = {
    "chicken": {"chicken", "chicken_boneless"}, "beef": {"beef", "mince"}, "keema": {"mince"}, "mince": {"mince"},
    "fish": {"fish"}, "egg": {"egg"}, "eggs": {"egg"}, "omelette": {"egg"}, "rice": {"rice"},
    "daal": {"masoor", "chana_daal", "mash"}, "dal": {"masoor", "chana_daal", "mash"}, "lentil": {"masoor"},
    "lentils": {"masoor"}, "lobia": {"lobia"}, "beans": {"lobia"}, "chana": {"chana", "roasted_chana"},
    "chickpea": {"chana", "roasted_chana"}, "chickpeas": {"chana", "roasted_chana"}, "potato": {"potato"},
    "aloo": {"potato"}, "vegetable": {"mixveg", "palak", "bhindi", "cabbage", "carrot", "capsicum"},
    "vegetables": {"mixveg", "palak", "bhindi", "cabbage", "carrot", "capsicum"}, "veg": {"mixveg", "palak", "bhindi"},
    "spinach": {"palak"}, "palak": {"palak"}, "okra": {"bhindi"}, "bhindi": {"bhindi"}, "pasta": {"pasta"},
    "noodles": {"noodles"}, "wrap": {"tortilla"}, "burrito": {"tortilla"}, "bread": {"bread"}, "toast": {"bread"},
    "sandwich": {"bread"}, "oats": {"oats"}, "porridge": {"oats"}, "milk": {"milk", "uht_milk"},
    "yogurt": {"dahi"}, "dahi": {"dahi"}, "curd": {"dahi"}, "cheese": {"cheese"}, "fruit": {"banana", "apple", "guava", "dates"},
    "banana": {"banana"}, "apple": {"apple"}, "peanut": {"peanuts", "peanut_butter"}, "peanuts": {"peanuts", "peanut_butter"},
    "nuts": {"peanuts", "peanut_butter"}, "soya": {"soya"}, "tomato": {"tomato"}, "onion": {"onion"}, "paratha": {"atta"}}
CUISINE_WORDS = {"punjabi": "punjabi", "lahori": "punjabi", "sindhi": "sindhi", "karachi": "sindhi", "pashtun": "pashtun",
                 "peshawari": "pashtun", "chinese": "chinese", "italian": "italian", "western": "western",
                 "continental": "western", "mexican": "mexican", "arabic": "mideast", "mediterranean": "mideast",
                 "middle": "mideast", "desi": "desi", "light": "light", "healthy": "light"}
NAME_WORDS = {"soup", "salad", "curry", "stir-fry", "fried", "pulao", "khichdi", "wrap", "burrito", "pasta", "toast", "pancakes"}


def describe_options(plan, day, meal, text, kcal, protein, budget, kitchen=2, vegetarian=False, avoid=(),
                     foods=None, conditions=(), limit=6):
    """Meals matching a free-text wish such as 'something light with chicken and rice'."""
    import re
    foods = foods if foods is not None else load_foods()
    words = re.findall(r"[a-z\-]+", text.lower())
    cheap = any(w in words for w in ("cheap", "cheapest", "budget", "affordable"))
    protein_first = "protein" in words
    quick = any(w in words for w in ("quick", "fast", "easy", "simple"))
    scored, anymatch = [], False
    for c in build_candidates(foods, kitchen, vegetarian, avoid, conditions):
        if meal not in c["types"]:
            continue
        s = sum(2 for w in set(words) if w in KEYWORDS and KEYWORDS[w] & set(c["need"]))
        s += sum(1.5 for w in set(words) if CUISINE_WORDS.get(w) in c["cuisines"])
        s += sum(1 for w in set(words) if w in NAME_WORDS and w in c["name"].lower())
        if quick and c["time"] > 20:
            continue
        if s <= 0:
            continue
        anymatch = True
        ok, dc = _fits(plan, day, meal, c, kcal, protein, budget)
        if ok and c["name"] != plan["days"][day]["meals"][meal]["name"]:
            scored.append((s, c, dc))
    key = (lambda t: (t[1]["cost"])) if cheap else ((lambda t: -t[1]["protein"]) if protein_first else (lambda t: (-t[0], t[2])))
    best = {}
    for t in sorted(scored, key=key):
        best.setdefault(t[1]["mid"], t)
    rows = sorted(best.values(), key=key)[:limit]
    msg = None
    if not rows:
        msg = ("Some meals match, but none keep this day within your calories, protein and budget." if anymatch
               else "We don't have a meal like that yet. Try words like chicken, rice, daal, pasta, soup, wrap, eggs or a cuisine.")
    return [_opt(c, dc) for _, c, dc in rows], msg


def apply_swap(plan, day, meal, mid, scale, kitchen=2, vegetarian=False, avoid=(), foods=None, conditions=()):
    foods = foods if foods is not None else load_foods()
    for c in build_candidates(foods, kitchen, vegetarian, avoid, conditions):
        if c["mid"] == mid and c["scale"] == scale and meal in c["types"]:
            plan["days"][day]["meals"][meal] = _meal_out(c)
            _retotal(plan)
            return plan
    raise ValueError("That meal is not available.")


def tradeoff_curve(kcal, budget, kitchen=2, vegetarian=False, avoid=(), foods=None, conditions=(),
                   steps=(0.5, 0.65, 0.8, 1.0, 1.2, 1.5)):
    foods = foods if foods is not None else load_foods()
    cands = build_candidates(foods, kitchen, vegetarian, avoid, conditions)
    pts = []
    for k in steps:
        b = round(budget * k)
        pick = _solve_day(cands, kcal, 0, b, {}, {}, "any", "protein", conditions=conditions)
        if pick:
            pts.append({"budget": b, "feasible": True, "protein_g": round(sum(c["protein"] for c in pick.values())),
                        "cost": round(sum(c["cost"] for c in pick.values()))})
        else:
            pts.append({"budget": b, "feasible": False, "protein_g": None, "cost": None})
    return pts


def price_impact(kcal, protein, budget, price_overrides, days=7, kitchen=2, vegetarian=False, avoid=(),
                 cuisines=(), conditions=(), pantry=None, base_overrides=None, requests=()):
    base = dict(base_overrides or {})
    f0, f1 = load_foods(base), load_foods({**base, **price_overrides})
    i0, i1 = load_ingredients(base), load_ingredients({**base, **price_overrides})
    before = make_plan(kcal, protein, budget, days, kitchen, vegetarian, avoid, cuisines, f0, conditions, pantry, i0, requests)
    after = make_plan(kcal, protein, budget, days, kitchen, vegetarian, avoid, cuisines, f1, conditions, pantry, i1, requests)
    out = {"before": before, "after": after}
    if before["ok"] and after["ok"]:
        names = lambda p: {x["name"] for d in p["days"] for x in d["meals"].values()}
        b, a = names(before), names(after)
        out.update(weekly_cost_before=before["weekly_cost"], weekly_cost_after=after["weekly_cost"],
                   weekly_cost_change=after["weekly_cost"] - before["weekly_cost"],
                   added=sorted(a - b), removed=sorted(b - a))
    return out


def load_extras():
    return json.load(open(DATA / "extras.json", encoding="utf-8"))


def evaluate_food(food, servings, kcal, protein, goal="maintain", conditions=()):
    """Is this food a good fit for the person's goal? Simple, explainable rules - not medical advice."""
    k, p = food["kcal"] * servings, food["protein_g"] * servings
    c, f = food["carbs_g"] * servings, food["fat_g"] * servings
    pk, pp = 100 * k / kcal, (100 * p / protein if protein else 0)
    dens = 100 * p / k if k else 0                       # grams of protein per 100 kcal
    fat_pct = 100 * f * 9 / k if k else 0
    score, why = 0, []
    if pk > 40:
        score -= 2; why.append(f"On its own it is {pk:.0f}% of your day's calories.")
    elif pk > 25:
        score -= 1; why.append(f"It is a big share of your day: {pk:.0f}% of your calories.")
    else:
        why.append(f"It uses {pk:.0f}% of your day's calories and {pp:.0f}% of your protein.")
    lose, gain = goal in ("lose", "lose_fast"), goal in ("build", "gain", "active")
    if lose:
        if dens >= 8: score += 2; why.append("Lots of protein for its calories, which helps you feel full while losing weight.")
        elif dens < 4: score -= 1; why.append("Few protein grams for its calories, so it will not keep you full for long.")
        if k > 500: score -= 1; why.append("It is calorie-dense for a weight-loss goal.")
    elif gain:
        if p >= 20 or dens >= 6: score += 2; why.append(f"Good protein ({p:.0f} g) for building or gaining.")
        if goal == "gain" and k >= 400: score += 1; why.append("Helps you reach the extra calories you need to gain weight.")
        if dens < 3 and k > 300: score -= 1; why.append("Mostly calories with little protein.")
    else:
        if dens >= 6: score += 1; why.append("A good protein-to-calorie balance.")
        if dens < 3 and k > 300: score -= 1; why.append("Low in protein for its calories.")
    if fat_pct > 45: score -= 1; why.append(f"About {fat_pct:.0f}% of its calories come from fat.")
    if food.get("sugary"): score -= 2; why.append("It contains a lot of added sugar.")
    if "diabetes" in conditions:
        if c > 45 or food.get("sugary"): score -= 3; why.append(f"{c:.0f} g of carbohydrate (and sugar) is a lot for a diabetes-friendly plan. Check with your doctor.")
    if "low_fat" in conditions and fat_pct > 35:
        score -= 2; why.append("Too high in fat for a lower-fat plan.")
    level = "good" if score >= 2 else ("ok" if score >= 0 else "limit")
    verdict = {"good": "A good fit for your goal", "ok": "Fine in moderation", "limit": "Not ideal for your goal"}[level]
    tips = []
    if k > 0.25 * kcal:
        tips.append(f"Try about {max(0.5, round(0.25 * kcal / food['kcal'] * 2) / 2):g} serving (about {round(0.25 * kcal)} kcal) and keep the rest of the day lighter.")
    if dens < 5:
        tips.append("Pair it with eggs, yogurt, daal or chicken to add protein.")
    if fat_pct > 40:
        tips.append("Balance it with vegetables and a lighter next meal.")
    if food.get("sugary"):
        tips.append("Have it after a meal rather than on an empty stomach, and keep it occasional.")
    return {"name": food["name"], "serving": food.get("serving", ""), "servings": servings, "level": level, "verdict": verdict,
            "kcal": round(k), "protein_g": round(p, 1), "carbs_g": round(c, 1), "fat_g": round(f, 1),
            "pct_kcal": round(pk), "pct_protein": round(pp), "reasons": why, "tips": tips,
            "note": "A general guide based on your goal and the numbers above. It is not medical advice."}
