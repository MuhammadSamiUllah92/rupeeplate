import { useState } from "react";

export function WorkoutDay({ day }) {
  if (!day) return null;
  if (day.rest) return <div className="card workout rest"><h4>🛌 {day.weekday}: rest day</h4><p className="muted">{day.tip}</p></div>;
  return (<div className="card workout"><h4>🏋️ {day.weekday}: {day.title}</h4><p className="muted">{day.minutes} min · about {day.kcal} kcal burned</p>
    {day.blocks.map((b, i) => <details className={"wblock " + b.kind} key={i}><summary><b>{b.name}</b><span>{b.rx}</span></summary>
      {b.steps?.length > 0 ? <ol>{b.steps.map((s, k) => <li key={k}>{s}</li>)}</ol> : <p className="muted small">{b.minutes} min</p>}</details>)}</div>);
}

export default function WorkoutPlan({ plan, compact }) {
  const first = plan.days.findIndex((d) => !d.rest), [sel, setSel] = useState(Math.max(0, first));
  const w = plan.weekly;
  return (<div className="card wplan">
    <h3>Your training week</h3>
    <div className="wtotals"><div><b>{w.sessions}</b><small>workouts</small></div><div><b>{w.minutes}</b><small>minutes a week</small></div><div><b>~{w.kcal}</b><small>kcal burned a week</small></div></div>
    <div className="wstrip">{plan.days.map((d, i) => <button key={i} className={(i === sel ? "on " : "") + (d.rest ? "rest" : "")} onClick={() => setSel(i)}><small>{d.weekday.slice(0, 3)}</small><b>{d.rest ? "Rest" : d.title.split(" (")[0]}</b>{!d.rest && <em>{d.minutes} min</em>}</button>)}</div>
    <WorkoutDay day={plan.days[sel]} />
    {!compact && <><h4>How to progress</h4><ul>{plan.progression.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
    <div className="warn"><b>Safety.</b> {plan.notes.filter((n) => !n.startsWith("Few")).join(" ")}</div>
    {plan.notes.filter((n) => n.startsWith("Few")).map((n, i) => <p key={i} className="note">{n}</p>)}
    {!compact && <button className="btn ghost" onClick={() => window.print()}>Print or save as PDF</button>}
  </div>);
}
