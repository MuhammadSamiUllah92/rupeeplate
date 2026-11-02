import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { get, post, rs } from "../api.js";
import { useAuth } from "../auth.jsx";
import { GROUPS, MEALS, cuName, frac } from "../lib.js";

function Groups({ list }) {
  return (<div className="shop-grid">{GROUPS.map(([g, icon]) => {
    const rows = list.items.filter((r) => r.group === g); if (!rows.length) return null;
    return (<div className="shop-card" key={g}><h4><span>{icon}</span> {g}</h4>
      {rows.map((r) => <p key={r.name}><span>{r.name}{r.pantry && <small className="pantry-note">{r.pantry}</small>}</span><em>{r.quantity}</em><b>{rs(r.cost)}</b></p>)}
      <p className="sub"><span>Subtotal</span><b>{rs(rows.reduce((s, r) => s + r.cost, 0))}</b></p></div>);
  })}</div>);
}

function Shop({ plan }) {
  const [tab, setTab] = useState("week");
  const list = tab === "week" ? plan.shopping_list : plan.days[+tab].shopping_list;
  const extras = plan.days.flatMap((d) => (tab === "week" || +tab === d.day - 1 ? (d.extras || []).map((x) => ({ ...x, day: d.day })) : []));
  return (<div className="card"><h3>Shopping list</h3>
    <p className="muted small">What you will use, grouped by aisle. Buy the nearest pack size.</p>
    <div className="tabs"><button className={tab === "week" ? "on" : ""} onClick={() => setTab("week")}>Whole plan</button>
      {plan.days.map((d, i) => <button key={i} className={tab === String(i) ? "on" : ""} onClick={() => setTab(String(i))}>Day {d.day}</button>)}</div>
    <Groups list={list} />
    {extras.length > 0 && <div className="shop-card extras"><h4><span>🍽️</span> Foods you asked for</h4>{extras.map((x, i) => <p key={i}><span>{x.name}<small className="pantry-note">Day {x.day}, {x.meal}</small></span><em>{x.servings}×</em><b>{rs(x.cost)}</b></p>)}</div>}
    <div className="shop-total"><span>{tab === "week" ? "Whole plan" : `Day ${+tab + 1}`} total</span><b>{rs(list.total + extras.reduce((s, x) => s + x.cost, 0))}</b></div></div>);
}

function WhatIf({ res }) {
  const [ings, setIngs] = useState([]), [id, setId] = useState("chicken"), [pct, setPct] = useState(20), [out, setOut] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { get("/ingredients").then((l) => setIngs(l.filter((i) => i.group !== "Pantry" || ["oil", "sugar"].includes(i.id)))).catch(() => {}); }, []);
  const cur = ings.find((i) => i.id === id);
  async function go() {
    if (!cur) return; setBusy(true); setErr(""); setOut(null);
    const base = (res.params.price_overrides || {})[id] ?? cur.price;
    try { setOut(await post("/price-impact", { ...res.params, new_prices: { [id]: +(base * (1 + pct / 100)).toFixed(2) } })); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (<div className="card whatif"><h3>What if a price changes?</h3>
    <p className="muted">Change one ingredient's price and see what happens to your plan, including which meals the planner swaps.</p>
    <div className="wi-row"><label>Ingredient<select value={id} onChange={(e) => setId(e.target.value)}>{ings.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
      <label>Price change <b>{pct > 0 ? "+" : ""}{pct}%</b><input type="range" min="-50" max="100" step="5" value={pct} onChange={(e) => setPct(+e.target.value)} /></label>
      <button className="btn" onClick={go} disabled={busy}>{busy ? "Comparing…" : "Compare"}</button></div>
    {err && <p className="error">{err}</p>}
    {out && out.before?.ok && !out.weekly_cost_change && !out.added?.length && <p className="note">This price change does not affect your plan.</p>}
    {out && out.after && !out.after.ok && <p className="error">{out.after.message}</p>}
    {out && out.before?.ok && out.after?.ok && (out.weekly_cost_change !== 0 || out.added.length > 0) && <div className="wi-out">
      <div><small>Before</small><b>{rs(out.weekly_cost_before)}</b></div><div className="arrow">→</div><div><small>After</small><b>{rs(out.weekly_cost_after)}</b></div>
      <div className={out.weekly_cost_change > 0 ? "up" : "down"}><small>Change</small><b>{out.weekly_cost_change > 0 ? "+" : ""}{rs(out.weekly_cost_change)}</b></div>
      {(out.added.length > 0 || out.removed.length > 0) && <div className="swapped"><small>Meals the planner swapped</small>{out.removed.map((n) => <span className="chip out" key={n}>− {n}</span>)}{out.added.map((n) => <span className="chip in" key={n}>+ {n}</span>)}</div>}</div>}
  </div>);
}

function WeekTable({ plan, day, setDay }) {
  return (<div className="card weektable"><h3>Your plan at a glance</h3><div className="wt-scroll"><table>
    <thead><tr><th></th>{plan.days.map((d, i) => <th key={i} className={i === day ? "sel" : ""} onClick={() => setDay(i)}>Day {d.day}<small>{d.cuisine !== "any" ? cuName(d.cuisine) : "Any cuisine"}</small></th>)}</tr></thead>
    <tbody>{MEALS.map((m) => <tr key={m}><th className={"m-" + m}>{m}</th>
      {plan.days.map((d, i) => <td key={i} className={"m-" + m + (i === day ? " sel" : "")} onClick={() => setDay(i)}>{d.meals[m].name}<small>{rs(d.meals[m].cost)}</small></td>)}</tr>)}
      <tr className="daytot"><th>Day total</th>{plan.days.map((d, i) => <td key={i}><b>{rs(d.cost)}</b><small>{d.kcal} kcal · {d.protein_g} g protein</small></td>)}</tr></tbody>
  </table></div></div>);
}

function DayHero({ d, t }) {
  const kp = d.protein_g * 4, kc = (d.carbs_g || 0) * 4, kf = (d.fat_g || 0) * 9, tot = kp + kc + kf || 1;
  const pc = (v) => Math.round((100 * v) / tot);
  return (<div className="dayhero">
    <div className="dh-top"><div><p>Day {d.day}{d.cuisine !== "any" && ` · ${cuName(d.cuisine)}`}</p><h2>{rs(d.cost)}<small> food cost today</small></h2></div>
      <div className="dh-stats"><div><b>{d.kcal}</b><small>kcal · {Math.round((100 * d.kcal) / t.kcal)}% of target</small></div><div><b>{d.protein_g} g</b><small>protein · {Math.round((100 * d.protein_g) / t.protein)}%</small></div>
        <div><b>{Math.round(d.carbs_g || 0)} g</b><small>carbs</small></div><div><b>{Math.round(d.fat_g || 0)} g</b><small>fat</small></div></div></div>
    <div className="macro" aria-label="Where today's calories come from"><span style={{ width: pc(kp) + "%", background: "#f4b400" }} /><span style={{ width: pc(kc) + "%", background: "#7bbf5a" }} /><span style={{ width: pc(kf) + "%", background: "#e0705a" }} /></div>
    <div className="macro-key"><i style={{ background: "#f4b400" }} />Protein {pc(kp)}%<i style={{ background: "#7bbf5a" }} />Carbs {pc(kc)}%<i style={{ background: "#e0705a" }} />Fat {pc(kf)}%</div>
  </div>);
}

function Photo({ meal, type, credits }) {
  const [ok, setOk] = useState(true), c = credits[meal.mid];
  return (<div className={"photo p-" + type}>
    {ok && meal.mid ? <img src={`/meal-photos/${meal.mid}.jpg`} alt={meal.name} loading="lazy" onError={() => setOk(false)} /> : <div className="ph"><b>{meal.name}</b><span>Run fetch_photos.py to add real photos</span></div>}
    <span className="phchip">{type}</span>{ok && c && <a className="credit" href={c.page} target="_blank" rel="noreferrer">Photo: {c.author}, {c.license}</a>}</div>);
}

export default function Results({ res, setRes, day, setDay, readonly }) {
  const { t, plan, curve, params } = res, d = plan.days[day];
  const { user } = useAuth();
  const [msg, setMsg] = useState(""), [swap, setSwap] = useState(null), [busy, setBusy] = useState(false), [want, setWant] = useState(""), [credits, setCredits] = useState({});
  useEffect(() => { fetch("/meal-photos/credits.json").then((r) => r.json()).then(setCredits).catch(() => {}); }, []);
  const data = (curve || []).filter((p) => p.feasible).map((p) => ({ budget: rs(p.budget), protein: p.protein_g }));

  async function save() {
    try {
      if (user) { await post("/plans", { data: res }); setMsg("Saved to your account ✓"); }
      else { const l = JSON.parse(localStorage.getItem("rupeeplate-saved2") || "[]"); l.unshift({ id: Date.now(), date: new Date().toLocaleDateString("en-GB"), res }); localStorage.setItem("rupeeplate-saved2", JSON.stringify(l.slice(0, 20))); setMsg("Saved in this browser ✓ (log in to keep it on every device)"); }
    } catch (e) { setMsg(e.message); }
  }
  const call = async (body, meal) => { setBusy(true); try { const r = await post("/swap", { plan, day, meal, params, ...body }); return r; } catch (e) { setSwap({ meal, options: [], err: e.message }); } finally { setBusy(false); } };
  const options = async (meal) => { setSwap({ meal, options: null }); const r = await call({ mode: "options" }, meal); if (r) setSwap({ meal, options: r.options }); };
  const describe = async (meal) => { const r = await call({ mode: "describe", text: want }, meal); if (r) setSwap({ meal, options: r.options, err: r.message }); };
  const apply = async (o) => { const r = await call({ mode: "apply", meal: swap.meal, mid: o.mid, scale: o.scale }, swap.meal); if (r) { setRes({ ...res, plan: r }); setSwap(null); } };
  const Item = ({ i }) => (<details className="item"><summary><b>{frac(i.servings)}×</b> {i.name}<small>{i.serving} · {rs(i.cost)}</small></summary>
    <div className="how"><p><b>{i.time_min ? `About ${i.time_min} min` : "No cooking needed"}</b> · per serving: {i.ing_text.join(", ")}</p><ol>{i.steps.map((x, k) => <li key={k}>{x}</li>)}</ol></div></details>);

  return (<>
    <div className="card sum"><div><small>Daily target</small><b>{t.kcal} kcal</b></div><div><small>Protein target</small><b>{t.protein} g</b></div>
      <div><small>Average per day</small><b>{rs(plan.average_daily_cost)}</b></div><div><small>Food value</small><b>{rs(plan.weekly_cost)}</b></div>
      {plan.pantry_saved > 0 && <><div><small>Cash to spend</small><b>{rs(plan.cash_total)}</b></div><div><small>Saved by your pantry</small><b>{rs(plan.pantry_saved)}</b></div></>}</div>
    <div className="toolbar"><button className="btn ghost" onClick={() => window.print()}>Print or save as PDF</button>
      {!readonly && (user && res.planId ? <Link className="btn" to="/progress">Saved to your account. Track my progress →</Link> : <button className="btn" onClick={save}>{user ? "Save to my account" : "Save this plan"}</button>)}</div>
    {msg && <p className="note">{msg}</p>}
    {[...(t.notes || []), ...(plan.notes || [])].map((n, i) => <p key={i} className="note">{n}</p>)}
    <p className="muted small">Costs are for ingredients cooked at home; gas and electricity are not included. If a cuisine has no breakfast dish, breakfast uses everyday meals.</p>
    <div className="screen-only">
      <WeekTable plan={plan} day={day} setDay={setDay} />
      <div className="tabs daytabs">{plan.days.map((x, i) => <button key={i} className={i === day ? "on" : ""} onClick={() => setDay(i)}>Day {x.day}</button>)}</div>
      <DayHero d={d} t={t} />
      <div className="meals">{MEALS.map((m) => { const x = d.meals[m], ex = (d.extras || []).filter((e) => e.meal === m); return (
        <div className="card meal" key={m}><Photo meal={x} type={m} credits={credits} />
          <div className="mbody"><p className="meal-name">{x.name}</p>
            <div className="mchips"><span>{rs(x.cost)}</span><span>{x.kcal} kcal</span><span>{x.protein_g} g protein</span>{x.portion !== 1 && <span className="big">Bigger portion ×{x.portion}</span>}</div>
            {x.items.map((i) => <Item key={i.id} i={i} />)}
            {ex.map((e, k) => <div className="req-box" key={k}>⭐ You asked for: <b>{e.servings}× {e.name}</b><small>{Math.round(e.kcal)} kcal · {Math.round(e.protein_g)} g protein · {rs(e.cost)}</small></div>)}
            {!readonly && <div><button className="btn ghost sm" onClick={() => options(m)} disabled={busy}>Swap this meal</button></div>}
            {swap?.meal === m && <div className="swap">
              <div className="want"><input value={want} onChange={(e) => setWant(e.target.value)} placeholder="Describe it: e.g. light chicken and rice" onKeyDown={(e) => e.key === "Enter" && describe(m)} /><button className="btn sm" onClick={() => describe(m)} disabled={busy || !want.trim()}>Find</button></div>
              {swap.options === null ? <p className="muted">Finding alternatives…</p> : swap.options.length === 0 && <p className="muted">{swap.err || "No other meal keeps this day on target."}</p>}
              {swap.options && swap.options.map((o) => <button key={o.mid + o.scale} className="swap-opt" onClick={() => apply(o)} disabled={busy}><b>{o.name}</b><small>{rs(o.cost)} · {o.kcal} kcal · {o.protein_g} g protein · day {rs(o.day_cost)}</small></button>)}
              <button className="btn ghost sm" onClick={() => setSwap(null)}>Close</button></div>}
          </div></div>); })}</div>
      <Shop plan={plan} />
      {!readonly && params && <WhatIf res={res} />}
      {data.length > 0 && <div className="card"><h3>What does each rupee buy?</h3>
        <p className="muted">The most protein one day can reach at different budgets (same calories). Budgets too low to reach your calories are left out.</p>
        <div style={{ height: 240 }}><ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="budget" /><YAxis unit=" g" width={50} /><Tooltip /><Bar dataKey="protein" fill="#0E6B4E" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div>}
    </div>
    <div className="print-only">{plan.days.map((x) => (<div key={x.day} className="pday"><h3>Day {x.day} · {rs(x.cost)} · {x.kcal} kcal · {x.protein_g} g protein</h3>
      {MEALS.map((m) => <p key={m}><b className="cap">{m}:</b> {x.meals[m].name} — {x.meals[m].items.map((i) => `${frac(i.servings)}× ${i.name} (${i.serving})`).join("; ")}{(x.extras || []).filter((e) => e.meal === m).map((e) => `; YOU ASKED FOR: ${e.servings}× ${e.name}`).join("")}</p>)}</div>))}
      <h3>Shopping list for the plan · {rs(plan.shopping_list.total)}</h3><Groups list={plan.shopping_list} />
      <h3>Recipes</h3>{[...new Map(plan.days.flatMap((x) => Object.values(x.meals).flatMap((m) => m.items)).map((i) => [i.id, i])).values()].map((i) => (
        <div key={i.id} className="pday"><b>{i.name}</b> ({i.serving}, {i.time_min ? i.time_min + " min" : "no cooking"}): {i.ing_text.join(", ")}. {i.steps.join(" ")}</div>))}</div>
  </>);
}
