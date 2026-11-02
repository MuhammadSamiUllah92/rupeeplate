import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { get, post } from "../api.js";
import { cleanDec, cleanInt, numErr } from "../validate.js";
import { useAuth } from "../auth.jsx";

const V = { on_track: ["On track", "good"], slower: ["Slower than planned", "ok"], too_fast: ["Faster than recommended", "ok"], wrong_direction: ["Moving the wrong way", "limit"], too_early: ["Too early to tell", "ok"], drifting: ["Drifting from maintenance", "ok"], check_health: ["Please check with a doctor", "limit"] };
const fmtDay = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function Progress() {
  const { user } = useAuth(), nav = useNavigate();
  const [ferrs, setFerrs] = useState({}), [s, setS] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [open, setOpen] = useState(false);
  const [f, setF] = useState({ weight_kg: "", waist_cm: "", workouts_done: 0, meal_days: 0, energy: 3, hunger: 3, unwell: false, notes: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (user) get("/progress").then((r) => { setS(r); setOpen(r.due); if (r.plan && !f.weight_kg) set("weight_kg", r.plan.weight_kg); }).catch((e) => setErr(e.message)); }, [user]);

  if (!user) return (<main className="wrap auth"><div className="card auth-card"><h1>Track your progress</h1><p className="muted">Log in so RupeePlate can remember your plans, ask how your week went, and tell you honestly whether your plan is working.</p>
    <Link className="btn big" to="/login">Log in</Link> <Link className="btn ghost big" to="/signup">Sign up</Link></div></main>);

  async function submit(e) {
    e.preventDefault(); setErr("");
    const v = { weight_kg: numErr(f.weight_kg, "Weight", 30, 250), waist_cm: numErr(f.waist_cm, "Waist", 40, 200, false, false), meal_days: numErr(f.meal_days, "Meal days", 0, s.plan.days, true), workouts_done: numErr(f.workouts_done, "Workouts", 0, 80, true) };
    Object.keys(v).forEach((k) => !v[k] && delete v[k]); setFerrs(v);
    if (Object.keys(v).length) { setErr("Please fix the highlighted fields."); return; }
    setBusy(true);
    try { const r = await post("/checkins", { ...f, weight_kg: +f.weight_kg, waist_cm: f.waist_cm ? +f.waist_cm : null, workouts_done: +f.workouts_done, meal_days: +f.meal_days }); setS(r); setOpen(false); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const chips = (k) => <div className="seg">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={f[k] === n ? "on" : ""} onClick={() => set(k, n)}>{n}</button>)}</div>;
  if (!s) return <main className="wrap planner"><h1>Your progress</h1><p className="muted">{err || "Loading…"}</p></main>;
  const a = s.analysis, p = s.plan, [vl, vc] = a ? V[a.verdict] || ["", "ok"] : [];
  const data = s.entries.map((e) => ({ day: fmtDay(e.day), weight: e.weight_kg }));
  function next() { const q = p.profile; nav("/planner", { state: { prefill: { sex: q.sex, age: q.age, height_cm: q.height_cm, activity: q.activity, goal: q.goal, days: q.days, conditions: q.conditions || [], weight_kg: a.weight, kcal_delta: a.kcal_delta } } }); }

  return (<main className="wrap planner"><p className="eyebrow">Progress</p><h1>Your progress</h1>
    {!p && <div className="card empty"><h3>No plan to track yet</h3><p className="muted">Make a meal plan while logged in. It is saved automatically, and we will ask how it went.</p><Link className="btn" to="/planner">Make a plan</Link></div>}
    {p && <>
      {s.due && !a && <div className="card due"><h3>👋 Welcome back! Time for a check-in</h3><p>It has been {s.days_since} days since your {p.goal_name} plan. Tell us how it went and we will see whether it is working.</p></div>}
      <div className="card sum"><div><small>Your goal</small><b className="cap">{p.goal_name}</b></div><div><small>Plan made</small><b>{fmtDay(p.date)}</b></div><div><small>Starting weight</small><b>{p.weight_kg} kg</b></div><div><small>Days since</small><b>{s.days_since}</b></div></div>
      {!open && <button className="btn" onClick={() => setOpen(true)}>Add a check-in</button>}
      {open && <form className="card" onSubmit={submit}><h3>How did it go?</h3>
        <div className="row3"><label>Weight now<span className="in"><input inputMode="decimal" className={ferrs.weight_kg ? "bad" : ""} value={f.weight_kg} onChange={(e) => set("weight_kg", cleanDec(e.target.value))} /><i>kg</i></span>{ferrs.weight_kg && <em className="ferr">{ferrs.weight_kg}</em>}</label>
          <label>Waist (optional)<span className="in"><input inputMode="decimal" className={ferrs.waist_cm ? "bad" : ""} value={f.waist_cm} onChange={(e) => set("waist_cm", cleanDec(e.target.value))} /><i>cm</i></span>{ferrs.waist_cm && <em className="ferr">{ferrs.waist_cm}</em>}</label></div>
        <div className="row3"><label>Meal days you followed<span className="in"><input inputMode="numeric" className={ferrs.meal_days ? "bad" : ""} value={f.meal_days} onChange={(e) => set("meal_days", cleanInt(e.target.value))} /><i>of {p.days}</i></span>{ferrs.meal_days && <em className="ferr">{ferrs.meal_days}</em>}</label>
          {p.planned_sessions > 0 && <label>Workouts you did<span className="in"><input inputMode="numeric" className={ferrs.workouts_done ? "bad" : ""} value={f.workouts_done} onChange={(e) => set("workouts_done", cleanInt(e.target.value))} /><i>planned {p.planned_sessions} a week</i></span>{ferrs.workouts_done && <em className="ferr">{ferrs.workouts_done}</em>}</label>}</div>
        <label>Energy (1 low, 5 great){chips("energy")}</label><label>Hunger (1 never, 5 always hungry){chips("hunger")}</label>
        <label className="chk"><input type="checkbox" checked={f.unwell} onChange={(e) => set("unwell", e.target.checked)} />I felt dizzy, unwell, or had pain or an injury</label>
        <label>Notes (optional)<input value={f.notes} maxLength={300} onChange={(e) => set("notes", e.target.value)} /></label>
        <button className="btn big" disabled={busy}>{busy ? "Saving…" : "Save check-in and see my progress"}</button>{err && <p className="error">{err}</p>}</form>}
      {a && <div className={"verdict " + vc}><h3>{vl}</h3>
        <div className="vstats"><div><small>Start</small><b>{a.start_weight} kg</b></div><div><small>Now</small><b>{a.weight} kg</b></div><div><small>Change</small><b>{a.change_kg > 0 ? "+" : ""}{a.change_kg} kg</b></div>
          <div><small>Per week</small><b>{a.rate_per_week > 0 ? "+" : ""}{a.rate_per_week} kg</b></div><div><small>Plan aimed for</small><b>{a.expected_per_week > 0 ? "+" : ""}{a.expected_per_week} kg</b></div></div>
        <ul>{a.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>{a.advice && <p><b>{a.advice}</b></p>}
        <p className="small muted">A general guide based on your weight and answers. Not medical advice.</p>
        {a.verdict !== "check_health" && <button className="btn" onClick={next}>Plan my next week with this</button>}</div>}
      {data.length > 1 && <div className="card"><h3>Your weight over time</h3><div style={{ height: 260 }}><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis domain={["dataMin - 1", "dataMax + 1"]} unit=" kg" width={64} /><Tooltip /><Line type="monotone" dataKey="weight" stroke="#0E6B4E" strokeWidth={3} dot={{ r: 5 }} /></LineChart></ResponsiveContainer></div></div>}
      {s.checkins.length > 0 && <div className="card"><h3>Check-in history</h3><div className="wt-scroll"><table><thead><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Meals</th><th>Energy</th><th>Hunger</th></tr></thead>
        <tbody>{[...s.checkins].reverse().map((c) => <tr key={c.id}><td>{fmtDay(c.day)}</td><td>{c.weight_kg} kg</td><td>{c.waist_cm ? c.waist_cm + " cm" : "–"}</td><td>{c.meal_days}</td><td>{c.energy}/5</td><td>{c.hunger}/5</td></tr>)}</tbody></table></div></div>}
    </>}
  </main>);
}
