"""Recipe book: whole recipes by cuisine, plus fast food, baked foods and sweets.

Nutrition and cost are ADDED UP from ingredients.csv (the same prices the meal planner uses),
so a recipe always agrees with the rest of the app. Changing the number of servings just multiplies every amount.
"""
import json
from pathlib import Path

import engine

BOOK = Path(__file__).with_name("data") / "recipe_book.json"
GROUPS = {"cuisine": "Cuisines", "fastfood": "Fast food", "baked": "Baked foods", "sweet": "Sweets and desserts"}
MEAT = {"chicken", "chicken_boneless", "beef", "mince", "fish"}      # an egg or milk is allowed in "vegetarian"
UNIT = engine.UNIT


def load_book():
    return json.load(open(BOOK, encoding="utf-8"))


def _fmt(x):
    """3.0 -> '3', 2.5 -> '2.5'."""
    return f"{x:g}"


def build(recipe, ings, servings=None):
    """Return one recipe with every amount, the nutrition and the cost for `servings` people."""
    servings = servings or recipe["serves"]
    scale = servings / recipe["serves"]
    total = {"kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "cost": 0.0}
    items = []
    for iid, amt in recipe["ing"].items():
        g = ings[iid]
        a = amt * scale
        a = round(a * 2) / 2 if g["unit"] == "pc" else (round(a) if a < 100 else round(a / 5) * 5)   # tidy numbers: 2.5 eggs, 120 g, 1250 g
        k = a / 100 if g["unit"] in ("kg", "l") else a                  # nutrition is per 100 g/ml, or per piece
        for n in ("kcal", "protein_g", "carbs_g", "fat_g"):
            total[n] += g[n] * k
        total["cost"] += engine._cost(g, a)
        items.append({"id": iid, "name": g["name"], "amount": a, "unit": UNIT[g["unit"]], "text": f"{_fmt(a)} {UNIT[g['unit']]} {g['name']}"})
    ids = set(recipe["ing"])
    allergens = sorted(k for k, s in engine.AVOID.items() if ids & s)
    per = {k: round(v / servings, 1 if k != "kcal" else 0) for k, v in total.items()}
    return {"id": recipe["id"], "name": recipe["name"], "group": recipe["group"], "group_name": GROUPS[recipe["group"]],
            "cuisine": recipe["cuisine"], "cuisine_name": engine.CUISINES.get(recipe["cuisine"]) if recipe["cuisine"] else None,
            "base_servings": recipe["serves"], "servings": servings, "time": recipe["time"], "level": recipe["level"],
            "veg": not (ids & MEAT), "allergens": allergens, "art": recipe["art"], "ingredients": items, "steps": recipe["steps"],
            "per_serving": per, "total": {k: round(v, 1 if k != "kcal" else 0) for k, v in total.items()}}


def search(group=None, cuisine=None, q="", veg=False, avoid=(), max_time=None):
    ings = engine.load_ingredients()
    out = []
    for r in load_book():
        if group and r["group"] != group:
            continue
        if cuisine and r["cuisine"] != cuisine:
            continue
        if q and q.lower() not in r["name"].lower():
            continue
        if max_time and r["time"] > max_time:
            continue
        b = build(r, ings)
        if veg and not b["veg"]:
            continue
        if set(avoid) & set(b["allergens"]):
            continue
        out.append({k: b[k] for k in ("id", "name", "group", "group_name", "cuisine", "cuisine_name", "time", "level", "veg", "allergens", "art", "per_serving")} | {"serves": r["serves"]})
    return out


def one(rid, servings=None):
    ings = engine.load_ingredients()
    for r in load_book():
        if r["id"] == rid:
            return build(r, ings, servings)
    return None
