"""Run:  python demo.py   - prints plans so you can see the engine working."""
import time
from engine import make_plan, shopping_list
from targets import calc_targets

def show(plan, days=2):
    if not plan["ok"]:
        print("  ->", plan["message"]); return
    for d in plan["days"][:days]:
        print(f"  Day {d['day']} ({d['cuisine']}): Rs {d['cost']:.0f} | {d['kcal']} kcal | {d['protein_g']} g protein")
        for meal, x in d["meals"].items():
            p = "" if x["portion"] == 1 else f"  [portion x{x['portion']}]"
            print(f"    {meal:<9} {x['name']}{p}")
    for n in plan["notes"]: print("  note:", n)
    print(f"  Average per day: Rs {plan['average_daily_cost']:.0f}   Week: Rs {plan['weekly_cost']:.0f}")

t = calc_targets(age=21, sex="male", height_cm=175, weight_kg=65, activity="light", goal="build")
print("Targets:", t["kcal"], "kcal,", t["protein"], "g protein")
for label, budget, kitchen, cu in [
        ("Full kitchen, Rs 700/day, Punjabi then Sindhi", 700, 2, ["punjabi", "sindhi", "pashtun", "light"]),
        ("No kitchen (hostel), Rs 700/day", 700, 0, []),
        ("Full kitchen, Rs 150/day (too low)", 150, 2, [])]:
    print("\n==", label)
    s = time.time(); p = make_plan(t["kcal"], t["protein"], budget, days=7, kitchen=kitchen, cuisines=cu)
    print(f"  solved in {time.time()-s:.1f} s"); show(p)
print("\n== Shopping list")
p = make_plan(t["kcal"], t["protein"], 700, days=7, kitchen=2)
sl = shopping_list(p)
for r in sl["items"][:10]: print(f"  {r['quantity']:>9}  {r['name']:<30} Rs {r['cost']:.0f}")
print(f"  Total: Rs {sl['total']:.0f}")
