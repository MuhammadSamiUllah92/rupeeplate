# RupeePlate: study guide for your evaluation

Read this, then open each file and find the thing it describes. You are being marked on explaining and changing YOUR code.
Be honest about what you know. It is fine to say "I'd look at validate.js for that" and then show it.

## 1. The 30-second pitch (say it in your own words)
RupeePlate is a web app that plans meals and workouts. You give it your goal, daily food budget in rupees, your kitchen
and your preferences. It builds a plan from whole meals at the lowest cost that meets your calories and protein,
makes a shopping list, and (if you are logged in) tracks your weight over time to check whether the plan works.

## 2. How the pieces fit
    Browser (React website, port 5173)
        |  fetch("/api/...")  with JSON
        v
    FastAPI server (Python, port 8000)  --  main.py (all the API endpoints)
        |-- auth.py        users, passwords, login tokens, the database connection
        |-- engine.py      builds meal plans (optimisation with PuLP)
        |-- exercise.py    builds workout plans
        |-- progress.py    check-ins and "is my plan working?"
        |-- prices.py      reads PBS price reports
        |-- targets.py     calories and protein from your details
        v
    SQLite database file: backend/rupeeplate.db   (tables: users, plans, checkins, feedback)

Why SQLite and not PostgreSQL (your proposal)? SQLite needs no separate server, so it is easier to run on a laptop.
The SQL is the same. Be ready to say this if asked about the change.

## 3. Registration, step by step (the flow they are most likely to ask about)
1. frontend/src/pages/Auth.jsx: you type in the form. The `e` object holds the validation errors (name, gender, date of birth, height, weight, email, password, confirm). Login only checks email and password.
   `pwChecks` in validate.js gives the password rules. If anything is wrong, `submit` stops and shows the red messages.
2. `enter("signup", {...})` in auth.jsx calls `post("/auth/signup", ...)` from api.js, which does a `fetch` with JSON.
3. backend/main.py `signup()` receives it as `SignupIn`. The `@field_validator` functions check the name and the password AGAIN (also gender, dob = real date and age 18 to 80, height 130-220 cm, weight 35-200 kg, activity and goal must be from the allowed lists)
   (never trust the browser). Then `auth.valid_email` checks the email format.
4. auth.py `create_user()` makes a random salt, hashes the password with PBKDF2 (200,000 rounds) in `_hash`, and runs
   `INSERT INTO users(...) VALUES(?,?,?,?)`. The `?` marks are parameters, which prevents SQL injection.
   The password itself is never stored, only the salt and the hash.
5. The server returns a signed token (`make_token`). The browser keeps it in localStorage and sends it as
   `Authorization: Bearer ...` on later requests. `user_id()` in main.py checks it.
6. Login: `check_login()` hashes the typed password with the stored salt and compares with `hmac.compare_digest`.

## 4. Validation: two layers
- Browser (instant messages): validate.js (`numErr`, `cleanInt`, `cleanDec`, `EMAIL`, `NAME`, `pwChecks`), used in Auth.jsx,
  Planner.jsx (`check()`), Progress.jsx, Feedback.jsx, Exercise.jsx.
- Server (cannot be bypassed): Pydantic models in main.py, e.g. `age: int = Field(ge=18, le=80)` in `TargetsIn`,
  `SignupIn`, `FeedbackIn`, `CheckInIn`. A bad value returns HTTP 422 with a message.
- Examples to demonstrate: age "abc" (cannot be typed), age 5 (message), email "a@b" (message), password "password" (checklist stays grey),
  empty name (required), feedback message under 10 characters.

## 5. Database connectivity (what is saved where)
- users: registration. plans: every plan built while logged in. checkins: Progress form. feedback: Feedback form.
- Show it live: run `python show_db.py` in the backend folder after registering. Or open rupeeplate.db in "DB Browser for SQLite".
- Retrieval: login reads `users`; Saved plans reads `plans`; Progress reads `checkins`; the Feedback page lists the latest 10 `feedback` rows.

## 6. How the meal plan is made (plain words)
- data/meals.json has about 70 whole meals (e.g. "Paratha, omelette and chai"), each made of dishes from data/recipes.json.
  Each dish lists raw ingredients in grams; data/ingredients.csv has ingredient prices and nutrition.
  So a dish's price and calories are ADDED UP from its ingredients (`load_foods` in engine.py).
- `build_candidates` makes every allowed meal in 3 portion sizes (SCALES), removing meals that need a bigger kitchen or contain foods you avoid.
- `_solve_day` picks one breakfast, lunch, dinner and snack for a day. It is an integer program: binary variables
  choose meals; constraints keep calories within 95-105% of target, protein above target, cost under budget,
  each meal's share of calories inside SHARE, fat limits, and no repeat of yesterday's meal. The objective is lowest cost
  plus a small VARIETY_PENALTY so the week does not repeat.
- `make_plan` loops over the days, remembers how often each meal was used (MAX_USES), and returns the plan.
- `attach_shopping` adds up ingredient amounts for the week and for each day, subtracting your pantry.
- Calories: targets.py `calc_targets` uses the Mifflin-St Jeor equation and never goes below KCAL_FLOOR (1400).

## 7. Other features, one line each
- Exercise (exercise.py): picks exercises by movement pattern (squat, push, pull...) that match your place, equipment, level and limits.
- Progress (progress.py `analyze`): compares your weight change per week with the goal rate (`EXPECTED`) and how well you followed the plan.
- Swap a meal / describe a meal (engine.py `swap_options`, `describe_options`): finds other meals that keep the day on target.
- Price update (prices.py): reads the PBS weekly report and writes data/prices_live.json. Not tested live, so say so.

## 8. Questions you may be asked (practise answers out loud)
1. Where is the password stored and how? (hash + salt in `users`, PBKDF2, never plain text)
2. What stops SQL injection? (parameterised queries with `?`)
3. Why validate on the server as well as the browser? (browser checks can be bypassed)
4. What happens if I register the same email twice? (UNIQUE constraint, server returns 409 and a message)
5. What is a token? (a signed string proving who you are, stored in localStorage)
6. How does React talk to Python? (fetch to /api, Vite proxy in vite.config.js forwards to port 8000)
7. What does `useState` do? What does `useEffect` do? (look at Auth.jsx: state for the form, effect in auth.jsx to restore login)
8. What is an optimisation problem here? (choose meals to minimise cost subject to constraints)
9. What if the budget is too low? (`make_plan` re-solves ignoring budget and tells the lowest daily budget that works)
10. Where are the prices from? (PBS report where available; others are estimates marked in ingredients.csv)
11. Which proposal features are done? (see section 10)
12. What would you improve? (real food photos, more meals, a mobile app, tested live price download)

## 9. Practice modifications (do each one tonight, then undo it)
1. Change the minimum age from 18 to 16: `TargetsIn.age` in main.py and `check()` in Planner.jsx. Restart the server.
2. Require passwords of at least 10 characters: `SignupIn` Field(min_length=...) and the validator regex in main.py, `pwChecks` in validate.js.
3. Change the main green colour: `--green` at the top of styles.css.
4. (Already done for gender, dob, height, weight, activity, goal: read `create_user` in auth.py and `SignupIn` in main.py, they are your template.) Add a "phone" field to registration: (a) Auth.jsx input + validation, (b) `SignupIn` in main.py, (c) `ALTER TABLE users ADD COLUMN phone` in auth.py `db()` (copy the full_name pattern), (d) the INSERT in `create_user`.
5. Change the safe calorie minimum from 1400 to 1500: `KCAL_FLOOR` in targets.py, and the `ge=` in PlanIn/TargetsIn/FoodIn in main.py, `Math.max(1400` in Planner.jsx.
6. Allow plans of only 1 to 10 days: `days` Field in main.py and the buttons in Planner.jsx.
7. Add a new meal: copy an entry in data/meals.json using dish ids from recipes.json. Restart and look for it.
8. Change a price: edit one line in data/ingredients.csv, rebuild a plan, and watch the cost change.
9. Add a new validation rule: feedback message at most 300 characters (FeedbackIn max_length, Feedback.jsx maxLength).
10. Change the text on the home page button: pages/Home.jsx.
11. Change the maximum times one meal can repeat: `MAX_USES` in engine.py.
12. Show a new column in the DB viewer: edit show_db.py.

## 10. Proposal features now working (use this for the "40%" question)
Register and log in (FR-1); targets from your details (FR-2); safe calorie floor (FR-3); budget, days, kitchen, exclusions (FR-4);
food database with sources (FR-5); editable prices (FR-6); plan generation under budget and calories (FR-7);
"budget too low" message with the minimum (FR-8); pantry (FR-9); budget chart (FR-10); price-change comparison (FR-11);
shopping list (FR-12); automatic PBS prices (FR-13/14, not tested live). Extras added: exercise plans, progress tracking, feedback, allergies, swap meals.

## 11. Before you walk in
- Run: backend `uvicorn main:app --reload`, frontend `npm run dev`, open http://localhost:5173. Close other heavy programs.
- Create a test account and one plan BEFORE the evaluation so the Progress and Saved pages have data.
- Know where each file is. If you cannot explain a part, say what it does at a high level and show where it lives.

## 9. New in step 15: Recipes, Fast food, logged-in home, Help

**How each one works (be ready to explain these)**

- **Recipes** (`backend/recipes.py`, `backend/data/recipe_book.json`, `frontend/src/pages/Recipes.jsx`).
  Each recipe is a list of ingredient ids and amounts for `serves` people. `build()` multiplies every amount by `servings / serves`,
  then ADDS UP calories, protein, carbs, fat and cost from `ingredients.csv` (the same prices as the meal planner).
  Allergens are worked out automatically from `engine.AVOID` (for example `maida` counts as gluten). "Vegetarian" means no meat or fish ingredient.
  Endpoints: `GET /api/recipes` (filters: group, cuisine, q, veg, avoid, max_time) and `GET /api/recipes/{id}?servings=N` (N must be 1 to 12, else 422).
- **Servings box** (`RecipeInner` in Recipes.jsx): `cleanInt` removes letters, `numErr(sv, "Number of people", 1, 12, true)` shows the error,
  and the server checks `Query(ge=1, le=12)` again.
- **Fast food (merged into the meal planner)**: in `pages/Planner.jsx`, the "Foods you want to eat" section has type buttons (`FOOD_TYPES`: fast food, desi, baked, sweets, drinks, lighter choices).
  The list comes from `data/extras.json`, where every item has a `type`, a price and nutrition. Choose an item, a day and a meal, press "Is it good for my goal?"
  (`POST /api/evaluate`, rules in `engine.evaluate_food`), then "Add it to my plan": the planner builds the other meals around it. If it costs more than the day's budget the planner says so.
- **Logged-in home** (`pages/Dashboard.jsx`, `GET /api/home`, `progress.today_view`): the day number is today minus the plan's start date; meals are that day of the saved plan; the workout is the exercise day whose weekday is today.
  `App.jsx` shows `<Dashboard />` at "/" when a user is logged in and `<Home />` for guests. The menu also differs.
- **Help** (`pages/Help.jsx`): FAQ accordion plus the feedback form (saved in the `feedback` table).
- **Pictures** (`components/Dish.jsx`): shows `/meal-photos/<id>.jpg` if it exists (run `python fetch_photos.py` on your own internet), otherwise draws an illustration from the recipe's `art` colours.

**Practice changes an examiner might ask for (try each one yourself)**

1. Allow up to 10 people instead of 12: `Query(ge=1, le=12)` in main.py, `numErr(..., 1, 12, true)` and `Math.min(12, ...)` in Recipes.jsx.
2. Add a new recipe: copy a block in `recipe_book.json`; ingredient ids must exist in `ingredients.csv`. No code change needed.
3. Add a new ingredient: add a row in `ingredients.csv` (price per kg, l or piece; nutrition per 100 g, or per piece).
4. Add "No shellfish" as an allergy filter: `Allergy` Literal and `engine.AVOID` in the backend, `ALLERGIES` array in Recipes.jsx.
5. Change the "good / fine / not ideal" rule: `engine.evaluate_food`, for example make the share-of-day limit 35% instead of 40%.
6. Add a "Snacks" type to the fast-food buttons: set `"type": "snack"` on items in extras.json and add `["snack", "Snacks"]` to `FOOD_TYPES` in Planner.jsx.
7. Show the dashboard greeting in Urdu: the `greeting()` function in Dashboard.jsx.

**Exercise is switched off for now.** The pages are parked in `frontend/_parked_exercise/` (not part of the build) and the website no longer links to them.
`/exercise` and `/fast-food` redirect to the meal planner. The backend files `exercise.py` and the `/api/exercise/plan` endpoint are still there, unused by the website.
