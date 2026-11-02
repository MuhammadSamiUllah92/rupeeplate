import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post, rs } from "../api.js";
import { useAuth } from "../auth.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import { ACTIVITY, GOALS, label } from "../lib.js";
import { ageFrom, cleanDec, cleanInt, numErr } from "../validate.js";

const TYPES = [["", "All"], ["fast", "Fast food"], ["desi", "Desi favourites"], ["baked", "Baked"], ["sweet", "Sweets"], ["drink", "Drinks"], ["healthy", "Lighter choices"]];

export default function FastFood() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]), [type, setType] = useState("fast"), [loadErr, setLoadErr] = useState("");
  const [f, setF] = useState({ sex: "male", age: "21", height_cm: "172", weight_kg: "65", activity: "light", goal: "maintain", diabetes: false, low_fat: false });
  const [errs, setErrs] = useState({}), [t, setT] = useState(null), [tErr, setTErr] = useState("");
  const [qty, setQty] = useState({}), [res, setRes] = useState({}), [hint, setHint] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => { get("/extras").then(setItems).catch((e) => setLoadErr(e.message)); }, []);
  useEffect(() => {                                           // logged-in users: start from the details given at signup
    if (!profile) return;
    const a = ageFrom(profile.dob);
    setF((p) => ({ ...p, sex: profile.gender || p.sex, age: a ? String(a) : p.age, height_cm: String(profile.height_cm ?? p.height_cm), weight_kg: String(profile.weight_kg ?? p.weight_kg), activity: profile.activity || p.activity, goal: profile.goal || p.goal }));
  }, [profile]);

  async function calc(ev) {                                   // step 1: validate the form, then ask the server for calorie and protein targets
    ev.preventDefault(); setTErr(""); setHint("");
    const e = { age: numErr(f.age, "Age", 18, 80, true), height_cm: numErr(f.height_cm, "Height", 130, 220, true), weight_kg: numErr(f.weight_kg, "Weight", 35, 200) };
    Object.keys(e).forEach((k) => !e[k] && delete e[k]); setErrs(e); setRes({});
    if (Object.keys(e).length) { setT(null); return; }
    try { setT(await post("/targets", { age: +f.age, sex: f.sex, height_cm: +f.height_cm, weight_kg: +f.weight_kg, activity: f.activity, goal: f.goal })); } catch (x) { setTErr(x.message); }
  }
  async function check(it) {                                  // step 2: ask whether one item suits the goal
    if (!t) { setHint("Fill in the form above and press “Calculate my targets” first."); document.getElementById("ff-form")?.scrollIntoView({ behavior: "smooth" }); return; }
    const conditions = [f.diabetes && "diabetes", f.low_fat && "low_fat"].filter(Boolean);
    try { const r = await post("/evaluate", { food_id: it.id, servings: +(qty[it.id] || 1), kcal: Math.max(1400, Math.round(+t.kcal)), protein: Math.round(+t.protein), goal: f.goal, conditions }); setRes((p) => ({ ...p, [it.id]: r.evaluation })); } catch (x) { setRes((p) => ({ ...p, [it.id]: { error: x.message } })); }
  }
  const shown = items.filter((i) => !type || i.type === type);
  const num = (k, lab, u, dec) => <label>{lab}<span className="in"><input inputMode={dec ? "decimal" : "numeric"} autoComplete="off" className={errs[k] ? "bad" : ""} value={f[k]} onChange={(e) => set(k, dec ? cleanDec(e.target.value) : cleanInt(e.target.value))} /><i>{u}</i></span>{errs[k] && <em className="ferr">{errs[k]}</em>}</label>;
  return (
    <main className="wrap planner">
      <p className="eyebrow">Eating out</p><h1>Fast food and takeaway, checked against your goal</h1>
      <p className="muted">Popular items with their approximate price and nutrition. Tell us about yourself once, then see whether each item fits your goal and how much of your day it uses. Want to cook it at home instead? <Link to="/recipes">See the recipes.</Link></p>
      <form className="card ff-form" id="ff-form" onSubmit={calc} noValidate>
        <h3>Your targets {profile && <span className="muted small">(filled in from your account)</span>}</h3>
        <div className="seg">{["male", "female"].map((s) => <button type="button" key={s} className={f.sex === s ? "on" : ""} onClick={() => set("sex", s)}>{s}</button>)}</div>
        <div className="row3">{num("age", "Age", "yrs")}{num("height_cm", "Height", "cm")}{num("weight_kg", "Weight", "kg", true)}</div>
        <div className="row2"><label>Activity<select value={f.activity} onChange={(e) => set("activity", e.target.value)}>{ACTIVITY.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>
          <label>Goal<select value={f.goal} onChange={(e) => set("goal", e.target.value)}>{GOALS.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label></div>
        <label className="chk"><input type="checkbox" checked={f.diabetes} onChange={(e) => set("diabetes", e.target.checked)} />Diabetes-friendly (limit sugar and carbohydrates)</label>
        <label className="chk"><input type="checkbox" checked={f.low_fat} onChange={(e) => set("low_fat", e.target.checked)} />Lower-fat</label>
        <button className="btn">Calculate my targets</button>
        {tErr && <p className="error" role="alert">{tErr}</p>}
        {t && <p className="ok-note">Your day: about <b>{Math.max(1400, Math.round(t.kcal))} kcal</b> and <b>{Math.round(t.protein)} g protein</b> for “{label(GOALS, f.goal).split(" (")[0].toLowerCase()}”. Now press “Does it suit me?” on any item.</p>}
      </form>
      <div className="tabs">{TYPES.map(([k, l]) => <button key={k} className={type === k ? "on" : ""} onClick={() => setType(k)}>{l}</button>)}</div>
      {hint && <p className="error" role="alert">{hint}</p>}{loadErr && <p className="error" role="alert">{loadErr}</p>}
      <div className="rgrid ffgrid">
        {shown.map((it) => { const v = res[it.id]; return (
          <div className="card ffcard" key={it.id}>
            <h3>{it.name}</h3><p className="muted small">{it.serving}</p>
            <p className="rnums"><b>{it.kcal}</b> kcal · <b>{it.protein_g}</b> g protein · {it.carbs_g} g carbs · {it.fat_g} g fat</p>
            <p><b>{rs(it.price_pkr)}</b> <span className="muted small">approximate price</span></p>
            <div className="ffact"><label className="small">How many<select value={qty[it.id] || 1} onChange={(e) => { setQty({ ...qty, [it.id]: e.target.value }); setRes((p) => { const q = { ...p }; delete q[it.id]; return q; }); }}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <button type="button" className="btn ghost" onClick={() => check(it)}>Does it suit me?</button></div>
            {v && !v.error && <div className={"verdict " + v.level}><h4>{v.verdict}</h4><ul>{v.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>{v.tips.length > 0 && <p className="small"><b>Tip:</b> {v.tips[0]}</p>}</div>}
            {v?.error && <p className="error">{v.error}</p>}
          </div>); })}
      </div>
      <Disclaimer />
    </main>
  );
}
