# RupeePlate - engine, API, website and accounts

backend/ = planner + API (Python). frontend/ = the website (React).

## Files (inside backend/)
- data/ingredients.csv - ingredient prices (PKR) with the source of each price, plus nutrition
- auth.py     - accounts: sqlite database (rupeeplate.db is created on first run), signed login tokens
- progress.py - check-ins and the "is my plan working?" analysis (logged-in users)
- exercise.py + data/exercises.json - the workout planner (52 exercises, MET-based calorie estimates)
- data/meals.json      - 70 whole meals (e.g. "Paratha, omelette and chai") built from dishes, tagged by cuisine
- data/recipes.json    - every dish: ingredients in grams, steps, time, kitchen needed. A dish's price and nutrition are added up from its ingredients
- targets.py  - calorie and protein targets (Mifflin-St Jeor) with a 1,400 kcal safety floor
- engine.py   - the planner (mixed-integer optimisation with PuLP / CBC)
- demo.py     - runs example plans and prints them
- main.py     - the API (FastAPI): /api/plan, /api/targets, /api/tradeoff, /api/price-impact, /api/foods
- test_api.py - checks every endpoint without starting a server

## Run it (Windows PowerShell)
1. Put this folder at C:\dev\rupeeplate  (avoid folders with an apostrophe in the name)
2. Open PowerShell and run:

    cd C:\dev\rupeeplate\backend
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    python demo.py

You should see plans for a full kitchen, a no-kitchen hostel, and a budget that is too low.

## Start the API

    python test_api.py          (should end with ALL CHECKS PASSED)
    uvicorn main:app --reload

Then open http://127.0.0.1:8000/docs in your browser. Every endpoint has a
"Try it out" button. Stop the server with Ctrl+C.

## Important
Ingredient prices marked 'PBS' come from the Pakistan Bureau of Statistics weekly SPI reports
(pbs.gov.pk). Everything marked 'estimate - verify' is a placeholder: check it and update the
price in data/ingredients.csv. Nutrition values are approximate; cite a food composition table.

## Run the website (needs the API running in another PowerShell window)

    cd C:\dev\rupeeplate\frontend
    npm install
    npm run dev

Open http://localhost:5173 . Keep the API running (uvicorn main:app --reload) in the other window.

## Automatic price updates (PBS)
backend/prices.py reads the Pakistan Bureau of Statistics weekly annex (national-average column) and writes
backend/data/prices_live.json, which overrides the baseline prices. Ways to run it:

    python prices.py                       (downloads the latest report)
    python prices.py --file Annex.pdf      (a PDF you downloaded yourself)
    python prices.py --text report.txt     (text copied from the PDF)

Daily job on Windows (run once in PowerShell, adjust the path):

    schtasks /create /tn "RupeePlate prices" /sc daily /st 09:00 /tr "C:\dev\rupeeplate\backend\.venv\Scripts\python.exe C:\dev\rupeeplate\backend\prices.py"

The website also has an "Update prices from PBS now" button in the planner's price section.
If PBS changes its file names or layout the update fails safely and keeps the old prices.

## Real meal photos
The site shows a real photo for every meal. Download openly licensed ones (Wikimedia Commons) with:

    cd C:\dev\rupeeplate\backend
    python fetch_photos.py

Photos go to frontend/public/meal-photos/ and the photographer credits to credits.json (shown under each photo, as the
licences require). Search is automatic, so CHECK the photos and delete any that look wrong, then edit
backend/data/photo_queries.json and run `python fetch_photos.py --force`. You can also put your own photo there,
named after the meal id (for example b_paratha_omelette.jpg). Until a photo exists, the card shows a plain colour block.

## Database (for your demo)
SQLite database file backend/rupeeplate.db (created on first run), accessed from Python with the sqlite3 module.
Tables: users (id, email, salt, hash, full_name), plans (id, user_id, created, created_iso, data), checkins (id, user_id, day, weight_kg, waist_cm, ...).
Passwords are never stored: only a salted PBKDF2 hash. Show the contents with:   python show_db.py

## Form validation
Signup: full name (letters only), gender, date of birth (18 to 80, real date, not future), height (130-220 cm), current weight (35-200 kg), activity, goal, email format, strong password (8+ chars, upper, lower, number, symbol, no spaces) with live checklist, confirm password.
Planner: age (18-80, whole number), height, weight, calories, protein, prices, servings, custom food fields: numbers only, range-checked, required.
Check-in and exercise forms: required, ranges. The server checks everything again, so it cannot be bypassed.

The profile entered at signup is stored in the `users` table and pre-fills the meal planner and exercise forms. The weight is updated whenever you log a progress check-in. Login validates email format and a non-empty password on both the form and the server.

## Recipes, fast food, dashboard and help (step 15)
- **Recipes page** (/recipes): 40 recipes (cuisines, fast food, baked foods, sweets). Choose 1 to 12 people; amounts, nutrition and cost scale.
- **Fast food** is part of the meal planner: browse takeaway, desi, baked, sweets and drinks by type in "Foods you want to eat", check them against your goal, and add them to a day and meal.
- **Home page when logged in** (/): today's meals and workout, check-in reminder, your details, quick links. Guests see the public home page.
- **Help page** (/help): FAQ and the feedback form.
- **Photos for recipes:** `cd backend` then `python fetch_photos.py` (needs internet). It downloads openly licensed photos for every meal AND every recipe and saves the credits.
  Until you run it, recipes show a generated illustration.

The exercise planner is switched off for now (files parked in `frontend/_parked_exercise/`).

## Easiest way to run (one program, one address)
1. Install Python once. Then **double-click `run.bat`** (Windows) or run `sh run.sh` (Mac/Linux).
2. It creates the Python environment on the first run, starts the app and opens http://127.0.0.1:8000.
   The website is already built in `frontend/dist`, so Node.js is NOT needed for this.
3. Press Ctrl+C in the window to stop it.

If you change anything inside `frontend/src`, either use the two-window development mode (below, changes show instantly)
or rebuild once with `cd frontend` then `npm run build`, and refresh the page.

## Development mode (two windows, instant refresh)
- Window 1: `cd backend`, activate the environment, `python -m uvicorn main:app --reload` (port 8000)
- Window 2: `cd frontend`, `npm install` (first time), `npm run dev`, open http://localhost:5173
