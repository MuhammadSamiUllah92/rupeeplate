import { useEffect, useState } from "react";

// A real photo if /meal-photos/<id>.jpg exists (downloaded by backend/fetch_photos.py), otherwise a generated illustration.
// The illustration is drawn from the recipe's own colours (art = [base, accent, accent2]), so every dish looks different.

function rng(seed) {                                   // small repeatable random number generator: same id -> same picture
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function DishArt({ id, art }) {
  const [base, a1, a2] = art, r = rng(id), k = id.replace(/\W/g, "");
  const dots = (n, rad, col, op) => Array.from({ length: n }, (_, i) => {
    const ang = r() * 6.283, d = Math.sqrt(r()) * 52;
    return <circle key={col + i} cx={100 + Math.cos(ang) * d} cy={100 + Math.sin(ang) * d} r={rad * (0.6 + r() * 0.9)} fill={col} opacity={op} />;
  });
  const blobs = Array.from({ length: 8 }, (_, i) => {
    const ang = r() * 6.283, d = r() * 26;
    return <ellipse key={i} cx={100 + Math.cos(ang) * d} cy={100 + Math.sin(ang) * d} rx={30 + r() * 20} ry={26 + r() * 18} transform={`rotate(${r() * 180} 100 100)`} fill={i % 3 === 0 ? a1 : base} opacity={0.92} />;
  });
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Illustration of the dish">
      <defs>
        <radialGradient id={"pl" + k}><stop offset="0" stopColor="#ffffff" /><stop offset="0.8" stopColor="#f1f1ee" /><stop offset="1" stopColor="#dcdcd6" /></radialGradient>
        <radialGradient id={"hi" + k} cx="0.35" cy="0.3"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <filter id={"rough" + k} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed={Math.floor(r() * 90)} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="11" />
        </filter>
        <filter id={"blur" + k}><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <ellipse cx="104" cy="112" rx="90" ry="86" fill="#000" opacity="0.18" filter={`url(#blur${k})`} />
      <circle cx="100" cy="100" r="92" fill={`url(#pl${k})`} />
      <circle cx="100" cy="100" r="72" fill="none" stroke="#d3d3cd" strokeWidth="1.5" />
      <g filter={`url(#rough${k})`}>{blobs}{dots(26, 3.2, a2, 0.9)}{dots(16, 2.2, a1, 0.85)}</g>
      <circle cx="100" cy="100" r="92" fill={`url(#hi${k})`} />
    </svg>
  );
}

let credits = null;                                    // credits.json is loaded once and shared
const loadCredits = () => (credits ||= fetch("/meal-photos/credits.json").then((x) => x.json()).catch(() => ({})));

export default function Dish({ id, name, art, showCredit = false }) {
  const [ok, setOk] = useState(true), [c, setC] = useState(null);
  useEffect(() => { setOk(true); if (showCredit) loadCredits().then((all) => setC(all[id] || null)); }, [id]);
  return (
    <div className="dish">
      {ok ? <img src={`/meal-photos/${id}.jpg`} alt={name} loading="lazy" onError={() => setOk(false)} />
          : <><DishArt id={id} art={art} /><span className="ill">{showCredit ? "Illustration. Run fetch_photos.py to get a real photo." : "Illustration"}</span></>}
      {ok && showCredit && c && <span className="credit">Photo: {c.author}, {c.license}</span>}
    </div>
  );
}
