import { cleanDec } from "../validate.js";
import { EQUIP, EX_GOALS, LEVELS, LIMITS, PLACES } from "../lib.js";

export default function ExerciseForm({ v, set, showGoal, showWeight }) {
  const tog = (k, x) => set({ ...v, [k]: v[k].includes(x) ? v[k].filter((y) => y !== x) : [...v[k], x] });
  return (<div className="exform">
    {showGoal && <label>What is your goal?<select value={v.goal} onChange={(e) => set({ ...v, goal: e.target.value })}>{EX_GOALS.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>}
    <h4>Your level</h4><div className="seg">{LEVELS.map(([a, b]) => <button type="button" key={a} className={v.level === a ? "on" : ""} onClick={() => set({ ...v, level: a })}>{b}</button>)}</div>
    <h4>Workouts per week</h4><div className="seg">{[2, 3, 4, 5, 6].map((n) => <button type="button" key={n} className={v.days_per_week === n ? "on" : ""} onClick={() => set({ ...v, days_per_week: n })}>{n} days</button>)}</div>
    <h4>Time per workout</h4><div className="seg">{[20, 30, 45, 60, 75, 90].map((n) => <button type="button" key={n} className={v.minutes === n ? "on" : ""} onClick={() => set({ ...v, minutes: n })}>{n} min</button>)}</div>
    <h4>Where will you train?</h4>
    <div className="places">{PLACES.map(([a, b, c]) => <button type="button" key={a} className={"place" + (v.place === a ? " on" : "")} onClick={() => set({ ...v, place: a })}><b>{b}</b><small>{c}</small></button>)}</div>
    {v.place === "home_equip" && <><p className="muted small">What do you have?</p><div className="seg">{EQUIP.map(([a, b]) => <button type="button" key={a} className={v.equipment.includes(a) ? "on" : ""} onClick={() => tog("equipment", a)}>{b}</button>)}</div></>}
    <h4>Any limits?</h4><div className="seg">{LIMITS.map(([a, b]) => <button type="button" key={a} className={v.limits.includes(a) ? "on" : ""} onClick={() => tog("limits", a)}>{b}</button>)}</div>
    {showWeight && <label>Your weight (for calories burned)<span className="in"><input inputMode="decimal" value={v.weight_kg} onChange={(e) => set({ ...v, weight_kg: cleanDec(e.target.value) })} /><i>kg</i></span></label>}
  </div>);
}
