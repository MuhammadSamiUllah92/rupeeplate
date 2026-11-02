import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Results from "./Results.jsx";
import { get, post, rs } from "../api.js";
import { ageFrom, cleanDec, cleanInt, numErr } from "../validate.js";
import { ACTIVITY, ALLERGIES, CUIS, DIETS, GOALS, HEALTH, KITCHENS, cuName, label } from "../lib.js";

const EDIT = ["atta", "rice", "masoor", "egg", "chicken", "milk", "oil", "dahi", "onion", "tomato"];

const FOOD_TYPES = [["fast", "Fast food"], ["desi", "Desi favourites"], ["baked", "Baked"], ["sweet", "Sweets"], ["drink", "Drinks"], ["healthy", "Lighter choices"]];

export default function Planner() {
  const { user, profile } = useAuth(), loc = useLocation(), [adjust, setAdjust] = useState(0);
  const [f, setF] = useState({ sex: "male", age: 21, height_cm: 172, weight_kg: 65, activity: "light", goal: "maintain", budget: 500, kitchen: 2, vegetarian: false, days: 7, avoid: [], conditions: [], cuisines: Array(14).fill("any") });
  const [custom, setCustom] = useState(false);
  const [kp, setKp] = useState({ kcal: 2200, protein: 90 });
  const [ings, setIngs] = useState({}), [prices, setPrices] = useState({}), [pantry, setPantry] = useState({}), [pick, setPick] = useState({ id: "rice", amt: "" });
  const [status, setStatus] = useState(null), [pmsg, setPmsg] = useState("");
  const [errs, setErrs] = useState({}), [ftype, setFtype] = useState("");
  const [extras, setExtras] = useState([]), [q, setQ] = useState(""), [selFood, setSelFood] = useState(null), [customOn, setCustomOn] = useState(false);
  const [cf, setCf] = useState({ name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "", price_pkr: "" }), [rq, setRq] = useState({ servings: 1, day: 0, meal: "dinner" });
  const [reqs, setReqs] = useState([]), [ev, setEv] = useState(null), [evErr, setEvErr] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [res, setRes] = useState(null), [day, setDay] = useState(0), [view, setView] = useState("form");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const loadIngs = () => get("/ingredients").then((l) => { const m = {}; l.forEach((i) => (m[i.id] = i)); setIngs(m); setPrices(Object.fromEntries(EDIT.map((id) => [id, m[id]?.price]))); }).catch(() => {});
  // Logged-in users: start the form from the details they gave at signup (age is worked out from the date of birth).
  useEffect(() => {
    if (!profile || loc.state?.prefill) return;
    const age = ageFrom(profile.dob);
    setF((x) => ({ ...x, sex: profile.gender || x.sex, ...(age >= 18 && age <= 80 ? { age } : {}), height_cm: profile.height_cm ?? x.height_cm, weight_kg: profile.weight_kg ?? x.weight_kg, activity: profile.activity || x.activity, goal: profile.goal || x.goal }));
  }, [profile]);
  useEffect(() => { const pre = loc.state?.prefill; if (pre) { const { kcal_delta, ...rest } = pre; setF((x) => ({ ...x, ...rest })); setAdjust(kcal_delta || 0); } }, []);
  useEffect(() => { get("/extras").then(setExtras).catch(() => {}); loadIngs(); get("/prices/status").then(setStatus).catch(() => {}); }, []);
  const tog = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const setCu = (i, v) => set("cuisines", f.cuisines.map((c, k) => (k === i ? v : c)));
  const unit = (id) => ({ kg: "kg", l: "litres", pc: "pieces" }[ings[id]?.unit] || "");
  const addPantry = () => { const a = +pick.amt; if (!pick.amt || !(a > 0) || a > 10000) { setPmsg("Enter an amount above 0 (and under 10,000)."); return; } setPmsg(""); setPantry({ ...pantry, [pick.id]: ings[pick.id].unit === "pc" ? a : a * 1000 }); setPick({ ...pick, amt: "" }); };
  const showAmt = (id, a) => (ings[id]?.unit === "pc" ? `${a} pcs` : `${a / 1000} ${ings[id]?.unit === "l" ? "L" : "kg"}`);
  async function refresh() {
    setPmsg("Updating from PBS…");
    try { const r = await post("/prices/refresh", {}); setPmsg(`Updated ${r.count} prices (${r.source}).`); setStatus(r); loadIngs(); } catch (e) { setPmsg(e.message); }
  }

  const getTargets = () => custom ? Promise.resolve({ ...kp, notes: ["RupeePlate gives general food-planning estimates, not medical advice."] })
    : post("/targets", { age: +f.age, sex: f.sex, height_cm: +f.height_cm, weight_kg: +f.weight_kg, activity: f.activity, goal: f.goal });
  const foodObj = () => selFood ? selFood : customOn && +cf.kcal > 0 ? { name: cf.name || "My food", serving: "1 serving", kcal: +cf.kcal, protein_g: +cf.protein_g || 0, carbs_g: +cf.carbs_g || 0, fat_g: +cf.fat_g || 0, price_pkr: +cf.price_pkr || 0 } : null;
  async function checkFood() {
    setEvErr(""); setEv(null); const food = foodObj();
    const sv = numErr(rq.servings, "Servings", 0.5, 6);
    if (sv) { setEvErr(sv); return; }
    if (customOn && !selFood) {
      const m = (cf.name || "").trim().length < 2 ? "Give your food a name (at least 2 letters)." : numErr(cf.kcal, "Calories", 1, 3000) || numErr(cf.protein_g, "Protein", 0, 300, false, false) || numErr(cf.carbs_g, "Carbs", 0, 500, false, false) || numErr(cf.fat_g, "Fat", 0, 300, false, false) || numErr(cf.price_pkr, "Price", 0, 20000, false, false);
      if (m) { setEvErr(m); return; }
    }
    if (!food) { setEvErr("Pick a food from the list, or enter your own food with its calories."); return; }
    try { const t = await getTargets(); const r = await post("/evaluate", { ...(selFood ? { food_id: selFood.id } : { custom: food }), servings: +rq.servings, kcal: Math.max(1400, +t.kcal), protein: +t.protein, goal: f.goal, conditions: f.conditions }); setEv(r.evaluation); } catch (x) { setEvErr(x.message); }
  }
  function addReq() {
    const food = foodObj(); if (!food) return;
    setReqs([...reqs, { name: food.name, servings: +rq.servings, kcal: food.kcal, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g, price_pkr: food.price_pkr, day: +rq.day, meal: rq.meal }]);
    setEv(null); setSelFood(null); setQ(""); setCustomOn(false); setCf({ name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "", price_pkr: "" });
  }
  function check() {
    const e = {};
    e.age = numErr(f.age, "Age", 18, 80, true); e.height_cm = numErr(f.height_cm, "Height", 130, 220, true); e.weight_kg = numErr(f.weight_kg, "Weight", 35, 200);
    if (custom) { e.kcal = numErr(kp.kcal, "Calories", 1400, 4500, true); e.protein = numErr(kp.protein, "Protein", 20, 250, true); }
    EDIT.forEach((id) => { if (prices[id] !== "" && prices[id] != null && !(+prices[id] > 0 && +prices[id] <= 50000)) e["price_" + id] = "Enter a price above 0."; });
    Object.keys(e).forEach((k) => !e[k] && delete e[k]); setErrs(e); return Object.keys(e).length === 0;
  }
  async function build(e) {
    e.preventDefault(); setErr("");
    if (!check()) { setErr("Please fix the highlighted fields."); return; }
    setBusy(true);
    try {
      const t = await getTargets();
      const over = {}; EDIT.forEach((id) => { if (ings[id] && +prices[id] !== ings[id].price && +prices[id] > 0) over[id] = +prices[id]; });
      const body = { kcal: Math.max(1400, +t.kcal + adjust), protein: +t.protein, budget: +f.budget, days: +f.days, kitchen: +f.kitchen, vegetarian: f.vegetarian, avoid: f.avoid, conditions: f.conditions, cuisines: f.cuisines.slice(0, +f.days), pantry, requests: reqs.filter((r) => r.day < +f.days), price_overrides: over };
      const plan = await post("/plan", body);
      if (!plan.ok) { setErr(plan.message); setBusy(false); return; }
      const curve = await post("/tradeoff", { kcal: body.kcal, budget: body.budget, kitchen: body.kitchen, vegetarian: body.vegetarian, avoid: body.avoid, conditions: body.conditions, price_overrides: over });
      const full = { t, plan, curve: curve.points, params: body, profile: { goal: f.goal, activity: f.activity, sex: f.sex, age: +f.age, height_cm: +f.height_cm, weight_kg: +f.weight_kg, days: +f.days, conditions: f.conditions, kcal: body.kcal, kcal_adjust: adjust } };
      setRes(full); setDay(0); setView("plan");
      if (user) post("/plans", { data: full }).then((r) => setRes((x) => (x ? { ...x, planId: r.id } : x))).catch(() => {});
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const num = (k, lab, min, max, u, dec) => <label>{lab}<span className="in"><input inputMode={dec ? "decimal" : "numeric"} autoComplete="off" className={errs[k] ? "bad" : ""} value={f[k]} onChange={(e) => set(k, dec ? cleanDec(e.target.value) : cleanInt(e.target.value))} />{u && <i>{u}</i>}</span>{errs[k] && <em className="ferr">{errs[k]}</em>}</label>;
  const sel = (v, on, opts) => <select value={v} onChange={(e) => on(e.target.value)}>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>;
  const chips = (list, key) => <div className="seg">{list.map(([v, l]) => <button type="button" key={v} className={f[key].includes(v) ? "on" : ""} onClick={() => tog(key, v)}>{l}</button>)}</div>;

  if (view === "plan" && res) {
    const p = res.params, cu = [...new Set(f.cuisines.slice(0, +f.days))].filter((c) => c !== "any");
    const tags = [label(GOALS, f.goal), label(ACTIVITY, f.activity).split(" (")[0], `${res.t.kcal} kcal · ${res.t.protein} g protein`, `${rs(p.budget)} a day`, label(KITCHENS, f.kitchen), `${p.days} days`,
      ...(f.vegetarian ? ["Vegetarian"] : []), ...f.avoid.map((a) => "No " + a), ...f.conditions.map((c) => label(HEALTH, c).split(" (")[0]), ...cu.map(cuName),
      ...(adjust ? [`Calories ${adjust > 0 ? "+" : ""}${adjust} from your progress`] : []), ...p.requests.map((r) => `+ ${r.name} (day ${r.day + 1})`), ...(Object.keys(pantry).length ? [`Pantry: ${Object.keys(pantry).length} items`] : []), ...(Object.keys(p.price_overrides).length ? [`${Object.keys(p.price_overrides).length} prices edited`] : [])];
    return (<main className="wrap planner"><div className="plan-head"><div><p className="eyebrow">Your plan</p><h1>Your {p.days}-day meal plan</h1></div>
      <button className="btn" onClick={() => setView("form")}>Edit preferences</button></div>
      <div className="prefbar">{tags.map((t, i) => <span key={i} className="pref">{t}</span>)}</div>
      <Results res={res} setRes={setRes} day={day} setDay={setDay} /></main>);
  }
  return (
    <main className="wrap planner"><h1>Make your meal plan</h1><p className="muted">No account needed. Tell us about you, your budget and what you feel like eating.</p>
      {res && <button className="btn ghost" onClick={() => setView("plan")}>← Back to my plan</button>}
      {adjust !== 0 && <p className="note">Planning from your progress: your calories are adjusted by {adjust > 0 ? "+" : ""}{adjust} kcal a day. <button type="button" className="linkbtn" onClick={() => setAdjust(0)}>Remove the adjustment</button></p>}
      {!user && <p className="note">Want us to track whether this plan works? <Link to="/signup">Create a free account</Link> or <Link to="/login">log in</Link> before you build it, and we will ask how it went.</p>}
      <form className="card formwide" onSubmit={build}>
        <h3 className="firstq">How many days do you want to plan?</h3>
        <div className="daypick">{Array.from({ length: 14 }, (_, i) => i + 1).map((n) => <button type="button" key={n} className={+f.days === n ? "on" : ""} onClick={() => set("days", n)}>{n}</button>)}</div>
        <p className="muted small">{f.days} day{f.days > 1 ? "s" : ""} selected. Longer plans repeat fewer meals only if you have a bigger kitchen.</p>
        <div className="cols2"><div>
          <h3>About you</h3>
          <div className="seg">{["male", "female"].map((s) => <button type="button" key={s} className={f.sex === s ? "on" : ""} onClick={() => set("sex", s)}>{s}</button>)}</div>
          <div className="row3">{num("age", "Age", 18, 80)}{num("height_cm", "Height", 130, 220, "cm")}{num("weight_kg", "Weight", 35, 200, "kg", true)}</div>
          <label>Activity{sel(f.activity, (v) => set("activity", v), ACTIVITY)}</label>
          <label>Goal{sel(f.goal, (v) => set("goal", v), GOALS)}</label>
          <label className="chk"><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />I know my own targets</label>
          {custom && <div className="row3"><label>Calories<span className="in"><input inputMode="numeric" className={errs.kcal ? "bad" : ""} value={kp.kcal} onChange={(e) => setKp({ ...kp, kcal: cleanInt(e.target.value) })} /><i>kcal</i></span>{errs.kcal && <em className="ferr">{errs.kcal}</em>}</label>
            <label>Protein<span className="in"><input inputMode="numeric" className={errs.protein ? "bad" : ""} value={kp.protein} onChange={(e) => setKp({ ...kp, protein: cleanInt(e.target.value) })} /><i>g</i></span>{errs.protein && <em className="ferr">{errs.protein}</em>}</label></div>}
        </div><div>
          <h3>Budget and kitchen</h3>
          <label>Daily food budget <b>{rs(f.budget)}</b><input type="range" min="250" max="1500" step="10" value={f.budget} onChange={(e) => set("budget", e.target.value)} /></label>
          <div className="seg">{KITCHENS.map(([v, l]) => <button type="button" key={v} className={f.kitchen === v ? "on" : ""} onClick={() => set("kitchen", v)}>{l}</button>)}</div>
          <h3>Diet</h3>
          <label className="chk"><input type="checkbox" checked={f.vegetarian} onChange={(e) => set("vegetarian", e.target.checked)} />Vegetarian (eggs allowed)</label>
          {chips(DIETS, "avoid")}
        </div></div>
        <h3>Allergies and intolerances</h3>{chips(ALLERGIES, "avoid")}
        <h3>Health considerations</h3>{chips(HEALTH, "conditions")}
        <p className="warn">These options only filter meals. They are not medical advice and do not replace a doctor or dietitian. Always check ingredient labels if you have an allergy, as a plan cannot know about cross-contamination.</p>
        <h3>Foods you want to eat</h3>
        <p className="muted small">Craving something specific, like pizza, a burger, biryani or a sweet? Browse by type or search, check whether it suits your goal, and add it to a day and meal. The plan is built around it.</p>
        <div className="seg">{FOOD_TYPES.map(([k, l]) => <button type="button" key={k} className={ftype === k ? "on" : ""} onClick={() => { setFtype(ftype === k ? "" : k); setSelFood(null); setEv(null); setCustomOn(false); setQ(""); }}>{l}</button>)}</div>
        <div className="food-search"><input placeholder="Search: biryani, pizza, samosa, cola, protein shake…" value={q} onChange={(e) => { setQ(e.target.value); setSelFood(null); setEv(null); setCustomOn(false); }} />
          {(q || ftype) && !selFood && !customOn && <div className="food-list scroll">{extras.filter((x) => (!ftype || x.type === ftype) && x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40).map((x) => <button type="button" key={x.id} onClick={() => { setSelFood(x); setQ(x.name); }}>{x.name}<small>{x.serving} · {x.kcal} kcal · {x.protein_g} g protein · Rs {x.price_pkr}</small></button>)}
            {q && <button type="button" onClick={() => { setCustomOn(true); setCf({ ...cf, name: q }); }}>Enter “{q}” myself…</button>}</div>}</div>
        {customOn && <div className="row3 cf"><label>Name<input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} /></label>
          {[["kcal", "Calories"], ["protein_g", "Protein g"], ["carbs_g", "Carbs g"], ["fat_g", "Fat g"], ["price_pkr", "Price Rs"]].map(([k, l]) => <label key={k}>{l} (per serving)<input inputMode="decimal" value={cf[k]} onChange={(e) => setCf({ ...cf, [k]: cleanDec(e.target.value) })} /></label>)}</div>}
        {(selFood || customOn) && <div className="req-row"><label>Servings<input inputMode="decimal" value={rq.servings} onChange={(e) => setRq({ ...rq, servings: cleanDec(e.target.value) })} /></label>
          <label>Day{sel(rq.day, (v) => setRq({ ...rq, day: +v }), Array.from({ length: +f.days }, (_, i) => [i, `Day ${i + 1}`]))}</label>
          <label>Meal{sel(rq.meal, (v) => setRq({ ...rq, meal: v }), [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]])}</label>
          <button type="button" className="btn" onClick={checkFood}>Is it good for my goal?</button></div>}
        {evErr && <p className="error">{evErr}</p>}
        {ev && <div className={"verdict " + ev.level}><h4>{ev.verdict}</h4><p className="vnums">{ev.kcal} kcal · {ev.protein_g} g protein · {ev.carbs_g} g carbs · {ev.fat_g} g fat</p>
          <ul>{ev.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>{ev.tips.length > 0 && <p><b>Tips:</b> {ev.tips.join(" ")}</p>}<p className="small muted">{ev.note}</p>
          <button type="button" className="btn" onClick={addReq}>Add it to my plan anyway</button></div>}
        {reqs.length > 0 && <div className="seg">{reqs.map((r, i) => <button type="button" className="on" key={i} onClick={() => setReqs(reqs.filter((_, k) => k !== i))}>{r.servings}× {r.name} · day {r.day + 1} {r.meal} ✕</button>)}</div>}
        <h3>What do you feel like each day?</h3>
        <label>Same for all days{sel("", (v) => v && set("cuisines", Array(14).fill(v)), [["", "Choose…"], ...CUIS])}</label>
        <div className="cu-grid">{Array.from({ length: +f.days }, (_, i) => <label key={i}>Day {i + 1}{sel(f.cuisines[i], (v) => setCu(i, v), CUIS)}</label>)}</div>
        <details className="prices"><summary>Pantry: what I already have {Object.keys(pantry).length > 0 && `(${Object.keys(pantry).length})`}</summary>
          <p className="muted small">Meals that use these are cheaper for you, and your shopping list only shows what you still need to buy.</p>
          <div className="pantry-add"><select value={pick.id} onChange={(e) => setPick({ ...pick, id: e.target.value })}>{Object.values(ings).filter((i) => i.group !== "Pantry" || ["oil", "sugar"].includes(i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            <span className="in"><input type="number" step="any" min="0" placeholder="Amount" value={pick.amt} onChange={(e) => setPick({ ...pick, amt: e.target.value })} /><i>{unit(pick.id)}</i></span><button type="button" className="btn sm" onClick={addPantry}>Add</button></div>
          {pmsg && <p className="error small">{pmsg}</p>}
          <div className="seg">{Object.entries(pantry).map(([id, a]) => <button type="button" className="on" key={id} onClick={() => { const n = { ...pantry }; delete n[id]; setPantry(n); }}>{ings[id]?.name}: {showAmt(id, a)} ✕</button>)}</div></details>
        <details className="prices"><summary>Ingredient prices {status?.updated ? `(PBS prices from ${status.updated})` : "(baseline prices)"}</summary>
          <p className="muted small">Prices come from the Pakistan Bureau of Statistics weekly report. Change any price if your market differs.</p>
          <div><button type="button" className="btn ghost sm" onClick={refresh}>Update prices from PBS now</button> <span className="muted small">{pmsg}</span></div>
          <div className="cu-grid">{EDIT.filter((id) => ings[id]).map((id) => <label key={id}>{ings[id].name}<span className="in"><input inputMode="decimal" className={errs["price_" + id] ? "bad" : ""} value={prices[id] ?? ""} onChange={(e) => setPrices({ ...prices, [id]: cleanDec(e.target.value) })} /><i>/{ings[id].unit === "pc" ? "pc" : ings[id].unit}</i></span>{errs["price_" + id] && <em className="ferr">{errs["price_" + id]}</em>}</label>)}</div></details>
        <button className="btn big full" disabled={busy}>{busy ? "Choosing the best meals for your week…" : "Build my plan"}</button>
        {err && <p className="error" role="alert">{err}</p>}
      </form></main>);
}
