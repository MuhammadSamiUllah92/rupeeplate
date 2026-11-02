import { useEffect, useState } from "react";
import { get, post } from "../api.js";
import { useAuth } from "../auth.jsx";
import { EMAIL, NAME } from "../validate.js";

export default function Feedback() {
  const { user, name } = useAuth();
  const [v, setV] = useState({ name: "", email: "", rating: 0, message: "" }), [tried, setTried] = useState(false), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [list, setList] = useState([]);
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));
  const load = () => get("/feedback").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { if (user) setV((p) => ({ ...p, email: p.email || user, name: p.name || name || "" })); }, [user, name]);
  const e = {};
  if (!v.name.trim()) e.name = "Name is required."; else if (!NAME.test(v.name.trim())) e.name = "Use letters, spaces, dots, apostrophes or hyphens only.";
  if (!v.email.trim()) e.email = "Email is required."; else if (!EMAIL.test(v.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
  if (!v.rating) e.rating = "Please choose a rating from 1 to 5.";
  if (v.message.trim().length < 10) e.message = "Please write at least 10 characters.";
  async function submit(ev) {
    ev.preventDefault(); setTried(true); setMsg(""); setErr("");
    if (Object.keys(e).length) return;
    try { await post("/feedback", { name: v.name.trim(), email: v.email.trim(), rating: v.rating, message: v.message.trim() }); setMsg("Thank you! Your feedback was saved."); setV({ ...v, rating: 0, message: "" }); setTried(false); load(); } catch (x) { setErr(x.message); }
  }
  const bad = (k) => tried && e[k];
  return (<main className="wrap planner"><h1>Feedback</h1><p className="muted">Tell us what works and what does not. Your answer is saved in our database.</p>
    <div className="plan-grid"><form className="card" onSubmit={submit} noValidate>
      <label>Name<input className={bad("name") ? "bad" : ""} value={v.name} maxLength={60} onChange={(x) => set("name", x.target.value)} />{bad("name") && <em className="ferr">{e.name}</em>}</label>
      <label>Email<input className={bad("email") ? "bad" : ""} value={v.email} maxLength={100} onChange={(x) => set("email", x.target.value)} />{bad("email") && <em className="ferr">{e.email}</em>}</label>
      <label>Rating<div className="seg">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={v.rating >= n ? "on" : ""} onClick={() => set("rating", n)} aria-label={`${n} stars`}>★</button>)}</div>{bad("rating") && <em className="ferr">{e.rating}</em>}</label>
      <label>Message<textarea className={bad("message") ? "bad" : ""} rows="4" maxLength={500} value={v.message} onChange={(x) => set("message", x.target.value)} /><small className="muted">{v.message.length}/500</small>{bad("message") && <em className="ferr">{e.message}</em>}</label>
      <button className="btn big full">Send feedback</button>{msg && <p className="note">{msg}</p>}{err && <p className="error">{err}</p>}</form>
      <section><h3>Recent feedback</h3>{list.length === 0 && <p className="muted">No feedback yet. Be the first!</p>}{list.map((f, i) => <div className="card" key={i}><b>{f.name}</b> <span className="muted">· {"★".repeat(f.rating)} · {f.created}</span><p>{f.message}</p></div>)}</section></div></main>);
}
