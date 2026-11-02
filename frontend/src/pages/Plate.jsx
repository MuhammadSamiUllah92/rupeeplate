import { useState } from "react";
// Hand-drawn style plate: each dish is a small illustration. Real photos in /public/meal-photos/<meal id>.jpg replace it.
const D = {
  roti: ["flat", "#e9c58a", "#c98f4a"], paratha: ["flat", "#f0b95a", "#c27a22"], pancakes: ["flat", "#f2c98a", "#b9772f"],
  rice: ["rice", "#fffdf5", "#e5dfc9"], khichdi: ["rice", "#f4dc8a", "#c9a53c"], pulao: ["rice", "#f3e3b5", "#8a5a25"], fried_rice: ["rice", "#e9d2a0", "#d0612f"],
  daal_masoor: ["bowl", "#f2b23b", "#d58a12"], daal_chana: ["bowl", "#f6cf55", "#d9a21d"], daal_mash: ["bowl", "#efe2b8", "#bba15a"], lobia: ["bowl", "#d9b27a", "#8a5b2b"],
  chana_masala: ["bowl", "#b8662b", "#7e3f16"], soya: ["bowl", "#8a5a2c", "#5b3813"], lentil_soup: ["bowl", "#ee9a3a", "#c06a14"], tomato_soup: ["bowl", "#e2492f", "#b32814"],
  chicken_salan: ["bowl", "#d9622a", "#a63b10"], beef_curry: ["bowl", "#8c3a22", "#5c2010"], keema: ["bowl", "#9a5a35", "#6a3518"], shakshuka: ["bowl", "#d6402a", "#a02512"],
  aloo: ["bowl", "#e9b04a", "#c07d1c"], bhindi: ["bowl", "#6f9a3a", "#3f6a1c"], palak: ["bowl", "#3e7a3a", "#1f4f1f"], mixveg: ["bowl", "#d98a35", "#4f8f3a"],
  veg_stirfry: ["bowl", "#e08a2f", "#4f9a3a"], chicken_stirfry: ["bowl", "#d99a45", "#3f8a3a"], mashed_potato: ["bowl", "#f6ecc6", "#e0d29a"],
  chickpea_salad: ["salad", "#e8c97a", "#5aa04a"], salad: ["salad", "#7bbf5a", "#e0442f"],
  egg_boiled: ["egg"], omelette: ["omelette"], scrambled_eggs: ["omelette"],
  chai: ["cup", "#b8763a"], milk: ["cup", "#fbfbf6"], dahi: ["dahi"], banana: ["banana"], apple: ["fruit", "#d93a2f"], guava: ["fruit", "#a8cf6a"], dates: ["dates"],
  peanuts: ["dots", "#d4a263"], chana_roast: ["dots", "#a8743a"], peanut_butter: ["spread"], bread: ["bread"], cheese_toast: ["bread", "#f4c542"], oats: ["bowl", "#e6d2a8", "#c8ae7c"],
  pasta_tomato: ["pasta", "#e8542f"], pasta_chicken: ["pasta", "#e0833a"], chowmein: ["pasta", "#cf9b52"], chicken_breast: ["meat", "#d9a25f"], fish_fry: ["fish"],
  chicken_wrap: ["wrap"], bean_burrito: ["wrap"], shawarma_plate: ["bowl", "#e0a24a", "#a86a22"],
};
function Dish({ id, x, y, r }) {
  const [t, a, b] = D[id] || ["bowl", "#ddd", "#bbb"];
  const g = (kids) => <g transform={`translate(${x} ${y})`}>{kids}</g>;
  if (t === "flat") return g(<><circle r={r} fill={a} /><circle r={r * 0.7} fill="none" stroke={b} strokeWidth="1.5" strokeDasharray="3 4" /><circle cx={-r * .3} cy={-r * .2} r="2.5" fill={b} /><circle cx={r * .25} cy={r * .3} r="2" fill={b} /></>);
  if (t === "rice") return g(<><ellipse rx={r} ry={r * .8} fill={a} />{[[-9, -4], [4, -8], [10, 3], [-3, 6], [-12, 7], [0, 0]].map(([p, q], i) => <rect key={i} x={p * r / 24} y={q * r / 24} width="5" height="2" rx="1" fill={b} transform={`rotate(${i * 40})`} />)}</>);
  if (t === "bowl") return g(<><circle r={r} fill="#fff" stroke="#d9d4c6" strokeWidth="1.5" /><circle r={r * .82} fill={a} /><circle r={r * .5} fill={b} opacity=".55" /><circle cx={-r * .2} cy={-r * .25} r="3" fill="#fff" opacity=".35" /></>);
  if (t === "salad") return g(<><circle r={r} fill={a} />{[[-9, -6, b], [6, -9, "#fff"], [9, 5, b], [-6, 8, "#fff"], [0, 0, b]].map(([p, q, c], i) => <circle key={i} cx={p * r / 24} cy={q * r / 24} r="4" fill={c} />)}</>);
  if (t === "egg") return g(<><ellipse rx={r * .9} ry={r * .65} fill="#fffef8" stroke="#e8e2cc" /><circle r={r * .3} fill="#f6b21f" /></>);
  if (t === "omelette") return g(<><ellipse rx={r} ry={r * .7} fill="#f8d84f" /><path d={`M${-r} 0 Q0 ${-r * .9} ${r} 0`} fill="none" stroke="#e0b21c" strokeWidth="2" /></>);
  if (t === "cup") return g(<><rect x={-r * .6} y={-r * .5} width={r * 1.2} height={r} rx="5" fill={a} stroke="#cfc8b4" /><path d={`M${r * .6} ${-r * .2} q${r * .5} ${r * .1} 0 ${r * .5}`} fill="none" stroke="#cfc8b4" strokeWidth="3" /></>);
  if (t === "dahi") return g(<><circle r={r * .85} fill="#fff" stroke="#d9d4c6" strokeWidth="1.5" /><circle r={r * .65} fill="#fbf7ea" /><circle cx={-3} cy={-3} r="3" fill="#fff" /></>);
  if (t === "banana") return g(<path d={`M${-r} ${-r * .2} Q0 ${r * 1.1} ${r} ${-r * .5} Q0 ${r * .5} ${-r} ${-r * .2}Z`} fill="#f6d33a" stroke="#c9a512" strokeWidth="1.5" />);
  if (t === "fruit") return g(<><circle r={r * .8} fill={a} /><path d="M0 -14 q4 -8 8 -8" stroke="#4a7a2a" strokeWidth="2" fill="none" /></>);
  if (t === "dates") return g(<>{[-10, 0, 10].map((p, i) => <ellipse key={i} cx={p} cy={(i - 1) * 4} rx="7" ry="4" fill="#6a3b1c" transform={`rotate(${i * 25} ${p} 0)`} />)}</>);
  if (t === "dots") return g(<>{[[-9, -4], [0, -9], [9, -3], [-5, 5], [6, 7], [0, 0], [-12, 6]].map(([p, q], i) => <ellipse key={i} cx={p * r / 24} cy={q * r / 24} rx="4" ry="3" fill={a} />)}</>);
  if (t === "spread") return g(<><rect x={-r * .8} y={-r * .6} width={r * 1.6} height={r * 1.2} rx="6" fill="#e9d2a0" /><ellipse rx={r * .5} ry={r * .35} fill="#a9743a" /></>);
  if (t === "bread") return g(<><rect x={-r * .9} y={-r * .55} width={r * 1.1} height={r * 1.1} rx="6" fill="#ecd2a0" stroke="#c9a867" /><rect x={-r * .1} y={-r * .35} width={r * 1.1} height={r * 1.1} rx="6" fill={a || "#f1deb4"} stroke="#c9a867" /></>);
  if (t === "pasta") return g(<><circle r={r} fill="#fff" stroke="#d9d4c6" strokeWidth="1.5" />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${-r * .7} ${(i - 1.5) * 6} q${r * .35} -9 ${r * .7} 0 t${r * .7} 0`} fill="none" stroke={a} strokeWidth="3.5" strokeLinecap="round" />)}</>);
  if (t === "meat") return g(<><ellipse rx={r} ry={r * .6} fill={a} stroke="#9a6a2a" />{[-8, 0, 8].map((p) => <line key={p} x1={p - 3} y1={-6} x2={p + 3} y2={6} stroke="#8a5a20" strokeWidth="2" />)}</>);
  if (t === "fish") return g(<><ellipse rx={r * .8} ry={r * .45} fill="#d9b86a" stroke="#a98a3a" /><path d={`M${r * .7} 0 l${r * .4} -${r * .35} v${r * .7}Z`} fill="#d9b86a" stroke="#a98a3a" /><circle cx={-r * .45} cy="-2" r="2" fill="#333" /></>);
  if (t === "wrap") return g(<><rect x={-r} y={-r * .45} width={r * 2} height={r * .9} rx={r * .45} fill="#e8c88a" stroke="#c49a52" /><rect x={-r * .55} y={-r * .5} width={r * 1.1} height="5" rx="2" fill="#5aa04a" /></>);
  return g(<circle r={r} fill="#ddd" />);
}
const POS = { 1: [[0, 0, 36]], 2: [[-26, 0, 24], [26, 0, 24]], 3: [[-24, -18, 22], [24, -18, 22], [0, 26, 22]], 4: [[-26, -22, 20], [26, -22, 20], [-26, 24, 20], [26, 24, 20]] };
const BG = { breakfast: "#fff1cf", lunch: "#e2f2d3", dinner: "#dcebf7", snack: "#f5e3f1" };
export default function Plate({ meal, type }) {
  const [photo, setPhoto] = useState(true);
  const items = meal.items.slice(0, 4), pos = POS[items.length] || POS[4];
  return (
    <div className="plate-art" style={{ background: BG[type] }}>
      {photo && meal.mid ? <img src={`/meal-photos/${meal.mid}.jpg`} alt={meal.name} onError={() => setPhoto(false)} />
        : <svg viewBox="0 0 160 160" role="img" aria-label={`Illustration of ${meal.name}`}>
          <circle cx="80" cy="84" r="70" fill="#000" opacity=".08" /><circle cx="80" cy="80" r="70" fill="#fff" stroke="#e2dccb" strokeWidth="2" /><circle cx="80" cy="80" r="58" fill="#fbf9f2" stroke="#efe9d8" />
          {items.map((it, i) => <Dish key={it.id + i} id={it.id} x={80 + pos[i][0]} y={80 + pos[i][1]} r={pos[i][2]} />)}</svg>}
    </div>);
}
