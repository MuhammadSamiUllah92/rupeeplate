"""Exercise planner: builds a weekly training plan for a goal, level, time, place and equipment.
General fitness guidance, not medical advice. Calories burned are MET-based estimates."""
import json
import math
from pathlib import Path

DATA = Path(__file__).with_name("data")
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ALL_GYM = {"dumbbells", "bands", "pullup_bar", "bench", "jump_rope", "barbell", "cable", "machine"}
LIMIT_FLAGS = {"knee": "knee", "back": "spine", "shoulder": "shoulder", "low_impact": "high"}
SESSIONS = {"full": ["squat", "push", "pull", "hinge", "core", "lunge"], "upper": ["push", "pull", "push", "pull", "core"],
            "lower": ["squat", "hinge", "lunge", "squat", "core"], "push": ["push", "push", "push", "core"],
            "pull": ["pull", "pull", "pull", "core"], "legs": ["squat", "hinge", "lunge", "core"], "cardio": ["cardio"]}
TITLES = {"full": "Full body", "upper": "Upper body", "lower": "Lower body", "push": "Push (chest, shoulders, triceps)",
          "pull": "Pull (back, biceps)", "legs": "Legs and glutes", "cardio": "Cardio"}
SCHEDULE = {
    "build": {2: "full full", 3: "full full full", 4: "upper lower upper lower", 5: "push pull legs upper lower", 6: "push pull legs push pull legs"},
    "lose": {2: "full cardio", 3: "full cardio full", 4: "full cardio full cardio", 5: "full cardio upper lower cardio", 6: "full cardio upper cardio lower cardio"},
    "endurance": {2: "cardio full", 3: "cardio full cardio", 4: "cardio full cardio full", 5: "cardio full cardio lower cardio", 6: "cardio full cardio upper cardio lower"},
    "general": {2: "full cardio", 3: "full cardio full", 4: "upper lower cardio full", 5: "upper lower cardio full cardio", 6: "push pull legs cardio full cardio"}}
SPREAD = {2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5]}
ACTIVITY_FOR = {2: "light", 3: "light", 4: "moderate", 5: "moderate", 6: "high"}
SAFETY = ["Warm up before every session and stop if you feel sharp pain, dizziness or chest pain. See a doctor before starting if you have a heart, joint or medical condition, are pregnant, or have been inactive for a long time.",
          "Effort should feel hard but controlled. Keep 2 to 3 reps in reserve in the first two weeks.",
          "Calories burned are rough estimates (based on MET values). Do not eat extra to 'earn back' calories: your meal plan already includes your activity level."]
PROGRESSION = ["Week 1: learn each move with easy effort and good form.", "Week 2: add 1 to 2 reps to every set.",
               "Week 3: add a set, a slower tempo, or a harder variation (or a little more weight).", "Week 4: easier 'deload' week with one set less, then repeat from week 2 with harder versions."]


def load():
    return json.load(open(DATA / "exercises.json", encoding="utf-8"))


def available_equipment(place, equipment):
    return set(ALL_GYM) if place == "gym" else (set(equipment) if place == "home_equip" else set())


def _penalty(e, place):
    """Lower is better: prefer equipment that suits the place."""
    eq = set(e["eq"])
    if place == "gym":
        return 0 if eq & {"barbell", "cable", "machine"} else 0.3 if eq & {"dumbbells", "bench"} else 0.5 if eq else 0.9
    if place == "home_equip":
        return 0 if "dumbbells" in eq else 0.2 if eq else 0.6
    return 0


def _pick(pool, pattern, used, place="home_none"):
    c = [e for e in pool if e["pattern"] == pattern]
    if not c:
        return None
    c.sort(key=lambda e: (used.get(e["id"], 0) + _penalty(e, place), e["id"]))
    used[c[0]["id"]] = used.get(c[0]["id"], 0) + 1
    return c[0]


def _block(e, goal, level, weight, active_min=None):
    """Prescription, minutes and kcal for one exercise."""
    hold = e["id"] in ("plank", "side_plank", "wall_sit", "superman")
    if e["pattern"] == "cardio":
        mins = active_min or 10
        return {"rx": f"{mins} min" + (" (30 s hard, 60 s easy)" if goal == "lose" and "high" not in e["flags"] and mins >= 8 else " at a steady effort"),
                "minutes": mins, "kcal": e["met"] * weight * mins / 60}
    sets = 3 if level == 1 else 4
    if goal == "lose":
        mins = 3.0
        return {"rx": "3 rounds: 40 s work, 20 s rest", "minutes": mins, "kcal": e["met"] * weight * mins / 60}
    if hold:
        rx, per = f"{sets} × 30 to 45 s hold", 45 + 45
    elif goal == "endurance":
        rx, per = f"{sets - 1} × 15 to 20 reps", 20 * 3 + 45
    else:
        reps = "6 to 10" if e["eq"] and e["pattern"] in ("squat", "hinge", "push", "pull") and level >= 2 else "10 to 15"
        rx, per = f"{sets} × {reps} reps (rest 60 to 75 s)", 12 * 3 + 70
        if not e["eq"]:
            rx = f"{sets} × 8 to 20 reps (stop 2 reps before failure)"
    s = int(rx[0]) if rx[0].isdigit() else sets
    mins = round(s * per / 60, 1)
    return {"rx": rx, "minutes": mins, "kcal": e["met"] * weight * mins / 60}


def build_plan(goal="general", level=1, days_per_week=3, minutes=45, place="home_none", equipment=(), limits=(), weight_kg=65):
    goal = goal if goal in SCHEDULE else "general"
    equip = available_equipment(place, equipment)
    banned = {LIMIT_FLAGS[l] for l in limits if l in LIMIT_FLAGS}
    pool = [e for e in load() if set(e["eq"]) <= equip and e["lvl"] <= level and not (set(e["flags"]) & banned)]
    if not pool:
        return {"ok": False, "message": "No exercises match those settings."}
    used, days, notes = {}, [], []
    kinds = SCHEDULE[goal][days_per_week].split()
    slots = dict(zip(SPREAD[days_per_week], kinds))
    work = max(10, minutes - 10)
    for wd in range(7):
        kind = slots.get(wd)
        if not kind:
            days.append({"weekday": WEEKDAYS[wd], "index": wd, "rest": True, "title": "Rest day", "minutes": 0, "kcal": 0, "blocks": [],
                         "tip": "Rest, or take an easy 20 to 30 minute walk and stretch."})
            continue
        blocks = [{"kind": "warmup", "name": "Warm-up", "rx": "5 min: arm circles, hip circles, bodyweight squats, cat-cow", "minutes": 5, "kcal": 3 * weight_kg * 5 / 60, "steps": []}]
        if kind == "cardio":
            n = 1 if work <= 30 else 2
            for _ in range(n):
                e = _pick(pool, "cardio", used, place)
                if e:
                    b = _block(e, goal, level, weight_kg, round(work / n))
                    blocks.append({"kind": "main", "name": e["name"], "steps": e["steps"], "pattern": "cardio", **b})
        else:
            finisher = goal in ("lose", "endurance") and work >= 30
            left, pats, idx = work - (8 if finisher else 0), SESSIONS[kind], 0
            while left > 2.5 and idx < 9:
                pat = pats[idx % len(pats)]; idx += 1
                e = _pick(pool, pat, used, place)
                if not e:
                    continue
                b = _block(e, goal, level, weight_kg)
                if b["minutes"] > left + 1.5 and idx > 3:
                    break
                blocks.append({"kind": "main", "name": e["name"], "steps": e["steps"], "pattern": pat, **b}); left -= b["minutes"]
            if finisher:
                e = _pick(pool, "cardio", used, place)
                if e:
                    b = _block(e, goal, level, weight_kg, 8)
                    blocks.append({"kind": "main", "name": e["name"] + " (finisher)", "steps": e["steps"], "pattern": "cardio", **b})
        blocks.append({"kind": "cooldown", "name": "Cool-down", "rx": "5 min: hamstring stretch, chest stretch, child's pose, slow breathing", "minutes": 5, "kcal": 2.3 * weight_kg * 5 / 60, "steps": []})
        for b in blocks:
            b["minutes"], b["kcal"] = round(b["minutes"]), round(b["kcal"])
        days.append({"weekday": WEEKDAYS[wd], "index": wd, "rest": False, "title": TITLES[kind], "minutes": sum(b["minutes"] for b in blocks),
                     "kcal": sum(b["kcal"] for b in blocks), "blocks": blocks})
    if sum(1 for d in days for b in d["blocks"] if b["kind"] == "main") < days_per_week * 3 and goal != "endurance":
        notes.append("Few exercises are available with your equipment and limits, so sessions are shorter than requested. A little more equipment or a gym opens up many more options.")
    sess = [d for d in days if not d["rest"]]
    return {"ok": True, "goal": goal, "level": level, "place": place, "days": days, "notes": notes + SAFETY, "progression": PROGRESSION,
            "weekly": {"sessions": len(sess), "minutes": sum(d["minutes"] for d in sess), "kcal": sum(d["kcal"] for d in sess)},
            "activity_hint": ACTIVITY_FOR[days_per_week]}
