import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { get, rs } from "../api.js";
import Dish from "../components/Dish.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import { cleanInt, numErr } from "../validate.js";

const TABS = [["", "All"], ["cuisine", "Cuisines"], ["fastfood", "Fast food"], ["baked", "Baked foods"], ["sweet", "Sweets"]];
const ALLERGIES = [["dairy", "Dairy"], ["gluten", "Gluten"], ["nuts", "Nuts"], ["egg", "Egg"], ["fish", "Fish"], ["soy", "Soy"]];
const TIMES = [["", "Any time"], ["15", "Up to 15 min"], ["30", "Up to 30 min"], ["60", "Up to 1 hour"]];

// ---------- list page: /recipes
export function Recipes() {
  const [f, setF] = useState({ group: "", cuisine: "", q: "", veg: false, avoid: [], time: "" });
  const [data, setData] = useState({ groups: {}, cuisines: {}, recipes: [] }), [err, setErr] = useState(""), [busy, setBusy] = useState(true);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    const p = new URLSearchParams();                         // build the query string from the filters
    if (f.group) p.set("group", f.group);
    if (f.cuisine) p.set("cuisine", f.cuisine);
    if (f.q.trim()) p.set("q", f.q.trim());
    if (f.veg) p.set("veg", "true");
    f.avoid.forEach((a) => p.append("avoid", a));
    if (f.time) p.set("max_time", f.time);
    setBusy(true);
    get("/recipes?" + p).then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  }, [f]);
  const cuisines = Object.entries(data.cuisines).filter(([k]) => k !== "any");
  return (
    <main className="wrap planner">
      <p className="eyebrow">Recipes</p><h1>Cook something good</h1>
      <p className="muted">Recipes from every cuisine, plus fast food, baked foods and sweets you can make at home. Choose how many people you are cooking for and every amount, the nutrition and the cost change with it.</p>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={f.group === k ? "on" : ""} onClick={() => setF({ ...f, group: k, cuisine: k === "cuisine" || k === "" ? f.cuisine : "" })}>{l}</button>)}</div>
      <div className="card filters">
        <label>Search by name<input value={f.q} maxLength={40} placeholder="e.g. chicken, cake" onChange={(e) => set("q", e.target.value.replace(/[^A-Za-z ]/g, ""))} /></label>
        <label>Cuisine<select value={f.cuisine} onChange={(e) => setF({ ...f, cuisine: e.target.value, group: e.target.value ? "cuisine" : f.group })}><option value="">Any cuisine</option>{cuisines.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Cooking time<select value={f.time} onChange={(e) => set("time", e.target.value)}>{TIMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div><span className="lbl">Diet and allergies</span>
          <div className="seg"><button type="button" className={f.veg ? "on" : ""} onClick={() => set("veg", !f.veg)}>Vegetarian</button>
            {ALLERGIES.map(([k, l]) => <button type="button" key={k} className={f.avoid.includes(k) ? "on" : ""} onClick={() => set("avoid", f.avoid.includes(k) ? f.avoid.filter((x) => x !== k) : [...f.avoid, k])}>No {l.toLowerCase()}</button>)}</div></div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <p className="muted small">{busy ? "Loading…" : `${data.recipes.length} recipe${data.recipes.length === 1 ? "" : "s"}`}</p>
      <div className="rgrid">
        {data.recipes.map((r) => (
          <Link to={"/recipes/" + r.id} className="rcard" key={r.id}>
            <Dish id={r.id} name={r.name} art={r.art} />
            <div className="rbody"><h3>{r.name}</h3>
              <p className="muted small">{r.cuisine_name || r.group_name} · {r.time} min · {r.level}</p>
              <p className="rnums"><b>{r.per_serving.kcal}</b> kcal · <b>{r.per_serving.protein_g}</b> g protein · {rs(r.per_serving.cost)}<span className="muted small"> per serving</span></p>
              <div className="tags">{r.veg && <span className="tag green">Vegetarian</span>}{r.allergens.map((a) => <span className="tag" key={a}>{a}</span>)}</div></div>
          </Link>))}
      </div>
      {!busy && !data.recipes.length && !err && <p className="card">No recipe matches these filters. Try removing one.</p>}
      <Disclaimer />
    </main>
  );
}

// ---------- detail page: /recipes/:id  (servings selector scales everything)
export function RecipeDetail() {
  const { id } = useParams();
  return <RecipeInner key={id} id={id} />;                // key = id, so opening another recipe starts fresh
}

function RecipeInner({ id }) {
  const [base, setBase] = useState(null), [r, setR] = useState(null), [sv, setSv] = useState(""), [err, setErr] = useState("");
  const problem = sv === "" ? "" : numErr(sv, "Number of people", 1, 12, true);       // validation of the servings box
  useEffect(() => {
    if (sv === "" && base) return;                                                     // first load: use the recipe's own servings
    if (sv !== "" && problem) return;                                                  // invalid number: keep showing the last good result
    get(`/recipes/${id}` + (sv ? `?servings=${+sv}` : "")).then((d) => { setR(d); if (!base) setBase(d); if (sv === "") setSv(String(d.servings)); setErr(""); }).catch((e) => setErr(e.message));
  }, [id, sv]);
  if (err && !r) return <main className="wrap planner"><p className="error">{err}</p><Link to="/recipes">← All recipes</Link></main>;
  if (!r) return <main className="wrap planner"><p className="muted">Loading…</p></main>;
  const n = r.servings, step = (d) => setSv(String(Math.min(12, Math.max(1, (+sv || n) + d))));
  const N = ({ k, u = "" }) => <>{r.per_serving[k]}{u}</>;
  return (
    <main className="wrap planner">
      <Link to="/recipes" className="muted">← All recipes</Link>
      <div className="rdetail">
        <div><Dish id={r.id} name={r.name} art={r.art} showCredit /></div>
        <div>
          <p className="eyebrow">{r.cuisine_name || r.group_name}</p><h1>{r.name}</h1>
          <p className="muted">{r.time} minutes · {r.level} · {r.veg ? "Vegetarian" : "Contains meat or fish"}{r.allergens.length ? " · Contains: " + r.allergens.join(", ") : ""}</p>
          <div className="card srv"><b>Cooking for how many people?</b>
            <div className="stepper"><button type="button" className="btn ghost sm" onClick={() => step(-1)} aria-label="One person less">−</button>
              <input inputMode="numeric" className={problem ? "bad" : ""} value={sv} onChange={(e) => setSv(cleanInt(e.target.value).slice(0, 2))} aria-label="Number of people" />
              <button type="button" className="btn ghost sm" onClick={() => step(1)} aria-label="One person more">+</button></div>
            {problem ? <em className="ferr">{problem}</em> : <span className="muted small">Choose 1 to 12 people. The recipe is written for {r.base_servings}.</span>}</div>
          <div className="cost-line"><div><b>{rs(r.total.cost)}</b><span>total for {n}</span></div><div><b>{rs(r.per_serving.cost)}</b><span>per person</span></div></div>
        </div>
      </div>
      <div className="two">
        <section className="card"><h3>Ingredients for {n} {n === 1 ? "person" : "people"}</h3>
          <ul className="ing">{r.ingredients.map((i) => <li key={i.id}>{i.text}</li>)}</ul></section>
        <section className="card"><h3>Nutritional facts</h3>
          <table className="nutr"><thead><tr><th></th><th>Per person</th><th>All {n}</th></tr></thead><tbody>
            <tr><td>Calories</td><td><N k="kcal" /> kcal</td><td>{r.total.kcal} kcal</td></tr>
            <tr><td>Protein</td><td><N k="protein_g" /> g</td><td>{r.total.protein_g} g</td></tr>
            <tr><td>Carbohydrates</td><td><N k="carbs_g" /> g</td><td>{r.total.carbs_g} g</td></tr>
            <tr><td>Fat</td><td><N k="fat_g" /> g</td><td>{r.total.fat_g} g</td></tr></tbody></table>
          <p className="muted small">Added up from the ingredient list using the same prices and values as the meal planner. Approximate.</p></section>
      </div>
      <section className="card"><h3>How to cook it</h3><ol className="rsteps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></section>
      <Disclaimer />
    </main>
  );
}
