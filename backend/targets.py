"""Daily calorie and protein targets (Mifflin-St Jeor) with safety limits."""

ACTIVITY = {"low": 1.2, "light": 1.375, "moderate": 1.55, "high": 1.725, "athlete": 1.9}
KCAL_FLOOR = 1400          # never plan below this
MAX_DEFICIT = 500          # never plan more than this below maintenance
NOTICE = ("RupeePlate gives general food-planning estimates, not medical advice. "
          "If you have a medical condition, are pregnant, or are under 18, "
          "please ask a doctor or dietitian.")


def calc_targets(age, sex, height_cm, weight_kg, activity="light", goal="maintain"):
    """Return {'kcal', 'protein', 'maintenance', 'notes'} for one person."""
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "male" else -161)
    maintenance = bmr * ACTIVITY[activity]
    notes = []
    if goal == "lose":
        kcal, protein_per_kg = maintenance - 300, 1.4
    elif goal == "lose_fast":
        kcal, protein_per_kg = maintenance - 500, 1.6
    elif goal == "build":
        kcal, protein_per_kg = maintenance + 250, 1.6
    elif goal == "gain":
        kcal, protein_per_kg = maintenance + 500, 1.5
    elif goal == "active":
        kcal, protein_per_kg = maintenance + 100, 1.8
    else:
        kcal, protein_per_kg = maintenance, 1.2

    kcal = max(kcal, maintenance - MAX_DEFICIT)
    if kcal < KCAL_FLOOR:
        kcal = KCAL_FLOOR
        notes.append(f"Calories were raised to the safe minimum of {KCAL_FLOOR} kcal.")
    return {
        "kcal": round(kcal / 10) * 10,
        "protein": round(min(protein_per_kg, 2.0) * weight_kg),
        "maintenance": round(maintenance),
        "notes": notes + [NOTICE],
    }
