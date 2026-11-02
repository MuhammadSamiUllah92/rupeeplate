import { useState } from "react";
import Feedback from "./Feedback.jsx";
import Disclaimer from "../components/Disclaimer.jsx";

const FAQ = [
  ["Is RupeePlate medical advice?", "No. It gives general food and fitness estimates. We never plan below 1,400 kcal a day or more than 500 kcal below your maintenance level. If you have a health condition, are pregnant, or feel unwell, please see a doctor first."],
  ["How are my calorie and protein targets worked out?", "From your age, sex, height, weight and activity using the Mifflin-St Jeor equation, then adjusted for your goal (for example 300 kcal less to lose weight gently or 250 kcal more to build muscle)."],
  ["Where do the prices come from?", "A baseline price list, updated from Pakistan Bureau of Statistics reports when the price job is run. Every price shows its source. You can type your own price for any food and the plan will change."],
  ["Can I use it without an account?", "Yes. Guests can build a meal plan, check fast food against their goal, and browse recipes. An account lets you save plans, track your progress and get a personal home page."],
  ["How do the recipe servings work?", "Open any recipe and choose how many people you are cooking for (1 to 12). Every ingredient amount, the nutrition and the cost are multiplied to match."],
  ["Why does a fast-food item say “not ideal for your goal”?", "We compare the item with your day’s calories and protein, your goal and any diabetes or lower-fat setting. It is a simple, explainable rule set, not a ban: a smaller portion or a lighter day can make it fit."],
  ["How do I delete my data?", "Saved plans can be deleted from the Saved plans page. Deleting the whole account is planned for a later version."],
];

export default function Help() {
  const [open, setOpen] = useState(0);
  return (
    <>
      <main className="wrap planner"><p className="eyebrow">Help</p><h1>Questions and answers</h1>
        <div className="faqlist">{FAQ.map(([q, a], i) => (
          <div className={"faqitem" + (open === i ? " open" : "")} key={q}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>{q}<span>{open === i ? "−" : "+"}</span></button>
            {open === i && <p>{a}</p>}
          </div>))}</div>
        <Disclaimer />
      </main>
      <Feedback />
    </>
  );
}
