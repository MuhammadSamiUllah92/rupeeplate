"""Progress tracking: check-ins after a plan, and an honest read on whether the goal is working.
General guidance only, not medical advice."""
import json
from datetime import date, datetime

import auth

EXPECTED = {"maintain": 0.0, "lose": -0.27, "lose_fast": -0.45, "build": 0.12, "gain": 0.45, "active": 0.09}   # kg per week
GOAL_NAME = {"maintain": "maintain weight", "lose": "lose weight gently", "lose_fast": "lose weight steadily",
             "build": "build muscle", "gain": "gain weight", "active": "improve sports performance"}


def _plan_date(r):
    if r["created_iso"]:
        return date.fromisoformat(r["created_iso"])
    return datetime.strptime(r["created"], "%d/%m/%Y").date()


def latest_plan(uid):
    with auth.db() as c:
        rows = c.execute("SELECT * FROM plans WHERE user_id=? ORDER BY id DESC", (uid,)).fetchall()
    for r in rows:
        d = json.loads(r["data"])
        if d.get("profile"):
            plan = d.get("plan") or {}
            ex = plan.get("exercise") or {}
            return {"id": r["id"], "date": _plan_date(r), "profile": d["profile"], "plan_days": len(plan.get("days", [])) or 7,
                    "planned_sessions": (ex.get("weekly") or {}).get("sessions", 0) if ex.get("ok") else 0}
    return None


def analyze(profile, start_weight, start_date, ci, plan_days=7, planned_sessions=0):
    goal = profile.get("goal", "maintain")
    days = max(1, (date.fromisoformat(ci["day"]) - start_date).days)
    weeks = days / 7
    change = ci["weight_kg"] - start_weight
    rate = change / weeks
    pct = 100 * rate / start_weight
    exp = EXPECTED.get(goal, 0)
    parts = []
    if plan_days:
        parts.append(min(1, ci["meal_days"] / min(plan_days, max(1, days))))
    if planned_sessions:
        parts.append(min(1, ci["workouts_done"] / max(1, round(planned_sessions * weeks))))
    adherence = round(sum(parts) / len(parts), 2) if parts else None
    msgs, verdict = [], "on_track"
    if ci["unwell"]:
        verdict = "check_health"
        msgs.append("You said you felt unwell, dizzy or in pain. Please stop pushing harder and talk to a doctor before continuing. We will not suggest cutting calories or training harder.")
    elif days < 5:
        verdict = "too_early"
        msgs.append("It is too early to judge. Weight can move 1 to 2 kg from day to day because of water and food.")
    elif goal == "maintain":
        if abs(rate) <= 0.35:
            msgs.append("Your weight is stable, which is what maintaining means.")
        else:
            verdict = "drifting"
            msgs.append(f"Your weight is {'rising' if rate > 0 else 'falling'} by about {abs(rate):.2f} kg a week, but your goal is to stay the same.")
    elif exp < 0:
        if rate > 0.15:
            verdict = "wrong_direction"; msgs.append(f"Your weight went up by {change:+.1f} kg, the opposite of your goal.")
        elif pct < -1.0:
            verdict = "too_fast"; msgs.append(f"You lost about {abs(rate):.2f} kg a week ({abs(pct):.1f}% of your weight). That is faster than the usual safe range of about 1% a week.")
        elif rate <= exp * 0.6:
            msgs.append(f"You are losing about {abs(rate):.2f} kg a week, in line with your plan (about {abs(exp):.2f} kg).")
        else:
            verdict = "slower"; msgs.append(f"You are losing about {abs(rate):.2f} kg a week, slower than the {abs(exp):.2f} kg your plan aimed for.")
    else:
        top = 0.75 if goal in ("build", "active") else 1.0
        if rate < -0.15:
            verdict = "wrong_direction"; msgs.append(f"Your weight went down by {abs(change):.1f} kg, the opposite of your goal.")
        elif pct > top:
            verdict = "too_fast"; msgs.append(f"You are gaining {rate:.2f} kg a week. That is fast, and the extra is more likely to be fat than muscle.")
        elif rate >= exp * 0.5:
            msgs.append(f"You are gaining about {rate:.2f} kg a week, in line with your goal.")
        else:
            verdict = "slower"; msgs.append(f"You are gaining about {max(rate, 0):.2f} kg a week, slower than the {exp:.2f} kg your plan aimed for.")
    if 5 <= days < 10:
        msgs.append("Judge trends over 2 or more weeks, because a single week can mislead.")
    if adherence is not None:
        msgs.append(f"You followed about {round(adherence * 100)}% of the plan (meals and workouts).")
    delta, advice = 0, ""
    lose = exp < 0
    if verdict in ("slower", "wrong_direction", "too_fast", "drifting") and (adherence is None or adherence >= 0.7):
        delta = {"slower": (-100 if lose else 150), "wrong_direction": (-150 if lose else 200),
                 "too_fast": (150 if lose else -100), "drifting": (-100 if rate > 0 else 100)}[verdict]
        advice = f"Next plan: {'+' if delta > 0 else '−'}{abs(delta)} kcal a day from your usual target."
    elif verdict in ("slower", "wrong_direction", "too_fast", "drifting"):
        advice = "You followed less than 70% of the plan, so the result does not tell us much. Try following it more closely for another week before changing calories."
    if ci["energy"] <= 2 and delta < 0:
        delta, advice = 0, "Your energy is low, so we will not cut calories. Keep the same target and focus on sleep, protein and sticking to the plan."
    if ci["hunger"] >= 4 and delta < 0:
        delta, advice = 0, "You are very hungry, so we will not cut calories. Add more protein, vegetables and daal to keep full."
    if verdict == "check_health":
        delta, advice = 0, "See a doctor or dietitian before changing your plan."
    return {"verdict": verdict, "days": days, "start_weight": start_weight, "weight": ci["weight_kg"], "change_kg": round(change, 1),
            "rate_per_week": round(rate, 2), "expected_per_week": exp, "adherence": adherence, "messages": msgs,
            "kcal_delta": delta, "advice": advice, "goal": goal, "goal_name": GOAL_NAME.get(goal, goal)}


def checkins(uid):
    with auth.db() as c:
        rows = c.execute("SELECT * FROM checkins WHERE user_id=? ORDER BY day, id", (uid,)).fetchall()
    return [dict(r) for r in rows]


def add_checkin(uid, b):
    day = b.get("date") or date.today().isoformat()
    with auth.db() as c:
        c.execute("INSERT INTO checkins(user_id,day,weight_kg,waist_cm,workouts_done,meal_days,energy,hunger,unwell,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
                  (uid, day, b["weight_kg"], b.get("waist_cm"), b["workouts_done"], b["meal_days"], b["energy"], b["hunger"], int(b["unwell"]), b["notes"]))
    return state(uid)


def state(uid):
    plan, cis, today = latest_plan(uid), checkins(uid), date.today()
    out = {"plan": None, "due": False, "days_since": None, "checkins": cis, "entries": [], "analysis": None}
    with auth.db() as c:
        plans = c.execute("SELECT * FROM plans WHERE user_id=? ORDER BY id", (uid,)).fetchall()
    for r in plans:
        d = json.loads(r["data"])
        if d.get("profile"):
            out["entries"].append({"day": _plan_date(r).isoformat(), "weight_kg": d["profile"]["weight_kg"], "kind": "Plan start"})
    out["entries"] += [{"day": x["day"], "weight_kg": x["weight_kg"], "kind": "Check-in"} for x in cis]
    out["entries"].sort(key=lambda e: e["day"])
    if not plan:
        return out
    p = plan["profile"]
    out["plan"] = {"id": plan["id"], "date": plan["date"].isoformat(), "goal": p.get("goal"), "goal_name": GOAL_NAME.get(p.get("goal"), ""),
                   "weight_kg": p["weight_kg"], "days": plan["plan_days"], "planned_sessions": plan["planned_sessions"], "profile": p}
    after = [x for x in cis if date.fromisoformat(x["day"]) >= plan["date"]]
    out["days_since"] = (today - plan["date"]).days
    out["due"] = not after and out["days_since"] >= 5
    if after:
        ci = dict(after[-1]); ci["unwell"] = bool(ci["unwell"])
        out["analysis"] = analyze(p, p["weight_kg"], plan["date"], ci, plan["plan_days"], plan["planned_sessions"])
    return out


def today_view(uid):
    """For the logged-in home page: which day of the latest saved plan is it today, what to eat and which workout is due."""
    with auth.db() as c:
        rows = c.execute("SELECT * FROM plans WHERE user_id=? ORDER BY id DESC", (uid,)).fetchall()
    for r in rows:
        d = json.loads(r["data"])
        plan = d.get("plan") or {}
        days = plan.get("days") or []
        if not (d.get("profile") and days):
            continue
        start = _plan_date(r)
        n = (date.today() - start).days
        i = min(max(n, 0), len(days) - 1)
        meals = [{"slot": k, "name": v["name"]} for k, v in (days[i].get("meals") or {}).items()]
        ex = plan.get("exercise") or {}
        weekday = date.today().strftime("%A")
        w = next((x for x in ex.get("days", []) if x.get("weekday") == weekday), None) if ex.get("ok") else None
        return {"plan_id": r["id"], "created": start.isoformat(), "day_number": i + 1, "total_days": len(days), "finished": n >= len(days),
                "meals": meals, "kcal": round(days[i].get("kcal", 0)), "cost": round(days[i].get("cost", 0)),
                "goal_name": GOAL_NAME.get(d["profile"].get("goal"), ""), "workout": ({"title": w["title"], "minutes": w.get("minutes"), "rest": w.get("rest", False)} if w else None)}
    return None
