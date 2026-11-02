import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, rs } from "../api.js";
import { useAuth } from "../auth.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import { ACTIVITY, GOALS, label } from "../lib.js";

const SLOT = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

// Home page for logged-in users: what to eat today, what is due, and quick links.
export default function Dashboard() {
  const { name, user } = useAuth();
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => { get("/home").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <main className="wrap planner"><p className="error">{err}</p></main>;
  if (!d) return <main className="wrap planner"><p className="muted">Loading your dashboard…</p></main>;
  const { today, user: u, counts } = d, change = d.latest_weight && d.start_weight ? Math.round((d.latest_weight - d.start_weight) * 10) / 10 : null;
  const first = (name || user).split(" ")[0];
  const jump = [
    ["/planner", "Meal plan", "Build a new plan for 1 to 14 days, with fast-food checks"],
    ["/recipes", "Recipes", "Cook by cuisine, for any number of people"],
    ["/progress", "Progress", "Check in and see how you are doing"],
    ["/saved", "Saved plans", "Open or delete your plans"],
  ];
  return (
    <main className="hm dash2">
      <section className="hm-hero">
        <div className="wrap hm-hero-in">
          <div className="hm-copy">
            <h1>{greeting()}, {first}.</h1>
            <p className="hm-lead">{today ? (today.finished ? "Your plan has finished. Here is its last day." : `Day ${today.day_number} of ${today.total_days}${today.goal_name ? `, goal: ${today.goal_name}` : ""}. This is what is on your plate today.`) : "You have no saved plan yet. Build one and save it, and today’s meals will show up here."}</p>
            <div className="hm-cta">
              <Link className="btn gold big" to="/planner">{today && !today.finished ? "Plan more days" : "Build my plan"}</Link>
              <Link className="btn ghost big" to="/recipes">Browse recipes</Link>
            </div>
            {d.due && <p className="d-due"><b>Your check-in is due.</b> It has been {d.days_since} days since your plan started. <Link to="/progress">Check in now</Link></p>}
          </div>
          <div className="hm-bill" role="group" aria-label="Today's meals">
            <div className="hm-bill-head"><b>Today</b><span>{today ? (today.finished ? "Last day of your plan" : `Day ${today.day_number} of ${today.total_days}`) : "No plan yet"}</span></div>
            {today ? <>
              <ul className="hm-lines">{today.meals.map((m) => <li key={m.slot}><span className="k">{SLOT[m.slot] || m.slot}</span><span className="d">{m.name}</span></li>)}</ul>
              <dl className="hm-sum"><div><dt>Energy</dt><dd>about {today.kcal} kcal</dd></div><div className="save"><dt>Food cost today</dt><dd>{rs(today.cost)}</dd></div></dl>
            </> : <p className="hm-msg">Nothing here yet. Your first saved plan fills this bill.</p>}
          </div>
        </div>
        <div className="hm-truck" aria-hidden="true" />
      </section>

      <section className="wrap hm-sec d-cols">
        <div>
          <h2>About you</h2>
          <dl className="d-facts">
            <div><dt>Age</dt><dd>{u.age ?? "–"}</dd></div>
            <div><dt>Height</dt><dd>{u.height_cm ?? "–"} cm</dd></div>
            <div><dt>Weight now</dt><dd>{d.latest_weight ?? "–"} kg</dd></div>
            {change !== null && counts.checkins > 0 && <div><dt>Change so far</dt><dd>{change > 0 ? "+" : ""}{change} kg</dd></div>}
            <div><dt>Activity</dt><dd>{label(ACTIVITY, u.activity).split(" (")[0]}</dd></div>
            <div><dt>Goal</dt><dd>{label(GOALS, u.goal).split(" (")[0]}</dd></div>
          </dl>
          <p className="muted small">{counts.plans} saved plan{counts.plans === 1 ? "" : "s"}, {counts.checkins} check-in{counts.checkins === 1 ? "" : "s"}</p>
        </div>
        <div>
          <h2>Jump to</h2>
          <ul className="d-jump">{jump.map(([to, t, sub]) => <li key={t}><Link to={to}><b>{t}</b><span>{sub}</span></Link></li>)}</ul>
        </div>
      </section>
      <div className="wrap"><Disclaimer /></div>
    </main>
  );
}
