import { useEffect, useState } from "react";
import { useAuth } from "../auth.jsx";
import { Link } from "react-router-dom";
import { post } from "../api.js";
import { numErr } from "../validate.js";
import ExerciseForm from "../components/ExerciseForm.jsx";
import WorkoutPlan from "../components/WorkoutPlan.jsx";
import { EX_DEFAULT } from "../lib.js";

export default function Exercise() {
  const { profile } = useAuth(), [v, setV] = useState(EX_DEFAULT), [plan, setPlan] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { if (profile?.weight_kg) setV((x) => ({ ...x, weight_kg: String(profile.weight_kg) })); }, [profile]);
  async function build(e) {
    e.preventDefault(); setErr("");
    const m = numErr(v.weight_kg, "Weight", 35, 200);
    if (m) { setErr(m); return; }
    setBusy(true);
    try { setPlan(await post("/exercise/plan", { ...v, weight_kg: +v.weight_kg })); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (<main className="wrap planner"><div className="plan-head"><div><p className="eyebrow">Exercise</p><h1>Build your workout plan</h1></div>
    {plan && <button className="btn" onClick={() => setPlan(null)}>Change my answers</button>}</div>
    <p className="muted">Pick where you train and what you have. No account needed. Want meals that match your workouts? <Link to="/planner">Make a meal + exercise plan</Link>.</p>
    {!plan ? <form className="card formwide" onSubmit={build}><ExerciseForm v={v} set={setV} showGoal showWeight />
      <button className="btn big full" disabled={busy}>{busy ? "Building your week…" : "Build my workout plan"}</button>{err && <p className="error">{err}</p>}</form>
      : <WorkoutPlan plan={plan} />}</main>);
}
