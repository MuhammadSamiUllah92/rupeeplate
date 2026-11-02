import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post, rs } from "../api.js";

const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const CUISINES = ["Punjabi", "Sindhi and Karachi", "Pashtun", "Home-style desi", "Chinese", "Italian", "Western", "Mexican", "Middle Eastern", "Light and healthy"];
const PER = { kg: "per kg", l: "per litre", pc: "each" };

// Cost of one meal = sum of its ingredient items (the API returns each item's cost)
const mealCost = (m) => Math.round((m.items || []).reduce((s, i) => s + (i.cost || 0), 0));

function Bill({ budget, setBudget, day, msg }) {
  const total = day ? Math.round(day.cost) : 0, left = budget - total;
  return (
    <div className="hm-bill" role="group" aria-label="Sample day plan">
      <div className="hm-bill-head"><b>RupeePlate</b><span>One day, your budget</span></div>
      <label className="hm-slider">
        <span>Daily budget</span><output>{rs(budget)}</output>
        <input type="range" min="250" max="900" step="10" value={budget} onChange={(e) => setBudget(+e.target.value)} />
      </label>
      {day ? (
        <>
          <ul className="hm-lines">
            {MEALS.map((m) => (
              <li key={m}><span className="k">{m}</span><span className="d">{day.meals[m].name}</span><span className="lead-dots" aria-hidden="true" /><span className="p">{rs(mealCost(day.meals[m]))}</span></li>
            ))}
          </ul>
          <dl className="hm-sum">
            <div><dt>Food total</dt><dd>{rs(total)}</dd></div>
            <div className="save"><dt>Left in your pocket</dt><dd>{rs(Math.max(0, left))}</dd></div>
            <div><dt>Protein and energy</dt><dd>{day.protein_g} g, {day.kcal} kcal</dd></div>
          </dl>
        </>
      ) : <p className="hm-msg">{msg || "Writing your bill…"}</p>}
      <p className="hm-note">Drag the budget. The meals change with it.</p>
    </div>
  );
}

export default function Home() {
  const [ings, setIngs] = useState([]), [st, setSt] = useState(null);
  const [budget, setBudget] = useState(500), [day, setDay] = useState(null), [msg, setMsg] = useState("");
  useEffect(() => { get("/ingredients").then(setIngs).catch(() => {}); get("/prices/status").then(setSt).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => post("/plan", { kcal: 2200, protein: 90, budget, days: 1, kitchen: 2 })
      .then((p) => { if (p.ok) { setDay(p.days[0]); setMsg(""); } else { setDay(null); setMsg(p.message); } })
      .catch((e) => { setDay(null); setMsg(e.message); }), 300);
    return () => clearTimeout(t);
  }, [budget]);
  const show = ["atta", "rice", "masoor", "egg", "chicken", "milk"].map((id) => ings.find((f) => f.id === id)).filter(Boolean);

  return (
    <main className="hm">
      <section className="hm-hero">
        <div className="wrap hm-hero-in">
          <div className="hm-copy">
            <h1>Eat well on the rupees you have.</h1>
            <p className="hm-lead">Tell RupeePlate your goal, budget and what you feel like eating. You get real meals, recipes and a shopping list with the total, priced in rupees.</p>
            <div className="hm-cta"><Link className="btn gold big" to="/planner">Make my plan, no account</Link><Link className="btn ghost big" to="/recipes">Browse recipes</Link></div>
            <p className="hm-facts">70 whole meals, 40 recipes, 10 cuisines and {ings.length || 52} ingredient prices.</p>
          </div>
          <Bill budget={budget} setBudget={setBudget} day={day} msg={msg} />
        </div>
        <div className="hm-truck" aria-hidden="true" />
      </section>

      <section className="hm-board"><div className="wrap hm-board-in">
        <h2>Aaj ka bhao</h2>
        <ul>{show.map((f) => <li key={f.id}><span>{f.name}</span><b>{f.unit === "pc" ? "Rs " + Number(f.price).toFixed(1) : rs(f.price)}</b><small>{PER[f.unit]}</small></li>)}</ul>
        <p>{st?.updated ? `PBS prices updated ${st.updated}. Other items are estimates.` : "Baseline prices from PBS reports and estimates. You can edit any of them in the planner."}</p>
      </div></section>

      <section className="hm-cuisines wrap" aria-label="Cuisines">
        <p>Cook from</p>
        <ul>{CUISINES.map((c) => <li key={c}>{c}</li>)}</ul>
      </section>

      <section id="how" className="wrap hm-sec">
        <h2>From empty wallet to full plate in three steps</h2>
        <ol className="hm-steps">
          <li><i>1</i><h3>Tell us about you</h3><p>Goal, activity, allergies and how many days. Craving biryani? Add it and see if it suits your goal.</p></li>
          <li><i>2</i><h3>Set budget and kitchen</h3><p>Rupees per day, and a full kitchen, a kettle or nothing at all. Add what is already in your pantry.</p></li>
          <li><i>3</i><h3>Get your plan</h3><p>Meals with recipes, a shopping list sorted by aisle, and a chart of what each rupee buys.</p></li>
        </ol>
      </section>

      <section id="features" className="wrap hm-sec hm-feat">
        <div className="hm-feat-lead">
          <h2>Whole meals, not random foods</h2>
          <p>“Paratha, omelette and chai.” “Fried fish, rice and salad.” Every plan is made of dishes you would actually cook or order.</p>
          <ul>{["Chana with roti and chai", "Chicken stir-fry with rice", "Shakshuka with bread", "Tomato pasta with salad", "Bean burrito"].map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
        <dl className="hm-feat-list">
          <div><dt>Prices that follow the market</dt><dd>Reads the Pakistan Bureau of Statistics weekly report. Change any price and see which meals swap.</dd></div>
          <div><dt>Hostel mode</dt><dd>No kitchen? Plans are built from ready-to-eat foods.</dd></div>
          <div><dt>Pantry mode</dt><dd>Use what you already have first.</dd></div>
          <div><dt>Recipes and fast food</dt><dd>Cook any cuisine for any number of people. <Link to="/recipes">See the recipes</Link></dd></div>
          <div><dt>Cravings welcome</dt><dd>Pizza or biryani? Check it against your goal and add it to your plan. <Link to="/planner">Try it</Link></dd></div>
          <div><dt>Allergy and health filters</dt><dd>Nuts, dairy, gluten, diabetes-friendly and more.</dd></div>
          <div><dt>Budget chart</dt><dd>See how much protein each rupee buys.</dd></div>
          <div><dt>Swap or describe</dt><dd>Ask for “something light with chicken” and get it.</dd></div>
        </dl>
      </section>

      <section id="faq" className="wrap hm-sec hm-faq">
        <h2>Good to know</h2>
        <div>
          <details><summary>Is this medical advice?</summary><p>No. RupeePlate gives general food planning estimates and never plans below 1,400 kcal a day. If you have a medical condition, are pregnant or under 18, ask a doctor or dietitian.</p></details>
          <details><summary>Where do the prices come from?</summary><p>From the Pakistan Bureau of Statistics weekly report where available, and clearly marked estimates otherwise. You can edit any price.</p></details>
          <details><summary>Do I need an account?</summary><p>No. Anyone can make plans. An account adds saving plans and keeping them on every device.</p></details>
        </div>
      </section>

      <section className="hm-final">
        <div className="hm-truck flip" aria-hidden="true" />
        <div className="wrap hm-final-in">
          <h2>Ready in about a minute.</h2>
          <p>Pick your goal and budget. We handle the rest.</p>
          <div className="hm-cta"><Link className="btn dark big" to="/planner">Make my meal plan</Link><Link className="btn outline big" to="/signup">Create a free account</Link></div>
        </div>
      </section>
    </main>
  );
}
