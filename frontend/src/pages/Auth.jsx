import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { ACTIVITY, GOALS } from "../lib.js";
import { EMAIL, NAME, cleanDec, cleanInt, dobErr, isoYearsAgo, numErr, pwChecks } from "../validate.js";

const EMPTY = { name: "", email: "", pw: "", pw2: "", gender: "", dob: "", height: "", weight: "", activity: "light", goal: "maintain" };

export default function Auth({ mode }) {
  const signup = mode === "signup", { enter } = useAuth(), nav = useNavigate();
  const [v, setV] = useState(EMPTY), [show, setShow] = useState(false), [tried, setTried] = useState(false), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));

  // ---- validation (runs on every keystroke; messages are shown after the first submit attempt)
  const e = {};
  const email = v.email.trim();
  if (!email) e.email = "Email is required."; else if (!EMAIL.test(email) || email.length > 100) e.email = "Enter a valid email address, like name@example.com.";
  if (!v.pw) e.pw = "Password is required."; else if (signup && pwChecks(v.pw).some((c) => !c[0])) e.pw = "Your password does not meet all the rules below.";
  if (signup) {
    const nm = v.name.trim();
    if (!nm) e.name = "Full name is required."; else if (!NAME.test(nm)) e.name = "Use letters, spaces, dots, apostrophes or hyphens only (2 to 60 characters).";
    if (!v.gender) e.gender = "Please choose your gender.";
    const d = dobErr(v.dob); if (d) e.dob = d;
    const h = numErr(v.height, "Height", 130, 220, true); if (h) e.height = h;
    const w = numErr(v.weight, "Weight", 35, 200); if (w) e.weight = w;
    if (v.pw && email.split("@")[0].length >= 4 && v.pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) e.pw = "Your password should not contain your email name.";
    if (!v.pw2) e.pw2 = "Please confirm your password."; else if (v.pw2 !== v.pw) e.pw2 = "The two passwords do not match.";
  }
  const checks = pwChecks(v.pw), score = checks.filter((c) => c[0]).length;

  async function submit(ev) {
    ev.preventDefault(); setTried(true); setErr("");
    if (Object.keys(e).length) { document.querySelector(".auth-card .bad")?.focus(); return; }
    setBusy(true);
    try {
      await enter(mode, signup
        ? { full_name: v.name.trim(), email, password: v.pw, gender: v.gender, dob: v.dob, height_cm: +v.height, weight_kg: +v.weight, activity: v.activity, goal: v.goal }
        : { email, password: v.pw });
      nav("/");
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  const bad = (k) => tried && e[k];
  const msg = (k) => bad(k) && <em className="ferr">{e[k]}</em>;

  return (
    <main className="wrap auth"><form className="card auth-card" onSubmit={submit} noValidate>
      <h1>{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="muted">{signup ? "Tell us a little about you. We use it to set your calorie and protein targets automatically." : "Log in to see your saved plans and progress."}</p>

      {signup && <><h3>About you</h3>
        <label>Full name<input className={bad("name") ? "bad" : ""} value={v.name} maxLength={60} onChange={(x) => set("name", x.target.value)} placeholder="Muhammad Sami Ullah" autoComplete="name" />{msg("name")}</label>
        <div className="gl">Gender
          <div className="seg" role="radiogroup" aria-label="Gender">{["male", "female"].map((g) => <button type="button" key={g} role="radio" aria-checked={v.gender === g} className={v.gender === g ? "on" : ""} onClick={() => set("gender", g)}>{g}</button>)}</div>
          {msg("gender")}</div>
        <label>Date of birth<input type="date" className={bad("dob") ? "bad" : ""} value={v.dob} min={isoYearsAgo(80)} max={isoYearsAgo(18)} onChange={(x) => set("dob", x.target.value)} autoComplete="bday" /><small className="hint">You must be 18 or older.</small>{msg("dob")}</label>
        <div className="row2">
          <label>Height<span className="in"><input inputMode="numeric" autoComplete="off" className={bad("height") ? "bad" : ""} value={v.height} onChange={(x) => set("height", cleanInt(x.target.value))} placeholder="172" /><i>cm</i></span>{msg("height")}</label>
          <label>Current weight<span className="in"><input inputMode="decimal" autoComplete="off" className={bad("weight") ? "bad" : ""} value={v.weight} onChange={(x) => set("weight", cleanDec(x.target.value))} placeholder="65" /><i>kg</i></span>{msg("weight")}</label>
        </div>
        <label>How active are you?<select value={v.activity} onChange={(x) => set("activity", x.target.value)}>{ACTIVITY.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>
        <label>Your main goal<select value={v.goal} onChange={(x) => set("goal", x.target.value)}>{GOALS.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>
        <h3>Account</h3></>}

      <label>Email<input type="email" className={bad("email") ? "bad" : ""} value={v.email} maxLength={100} onChange={(x) => set("email", x.target.value)} placeholder="you@example.com" autoComplete="email" />{msg("email")}</label>
      <label>Password<span className="pwrow"><input type={show ? "text" : "password"} className={bad("pw") ? "bad" : ""} value={v.pw} maxLength={100} onChange={(x) => set("pw", x.target.value)} placeholder={signup ? "Choose a strong password" : "Your password"} autoComplete={signup ? "new-password" : "current-password"} /><button type="button" className="btn ghost sm" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button></span>{msg("pw")}</label>
      {signup && <><div className="meter" aria-hidden="true"><span style={{ width: (score / 6) * 100 + "%", background: score < 4 ? "#e0705a" : score < 6 ? "#f4b400" : "#2a9d6a" }} /></div>
        <ul className="pwlist">{checks.map(([ok, t]) => <li key={t} className={ok ? "ok" : ""}>{ok ? "✓" : "○"} {t}</li>)}</ul>
        <label>Confirm password<input type={show ? "text" : "password"} className={bad("pw2") ? "bad" : ""} value={v.pw2} maxLength={100} onChange={(x) => set("pw2", x.target.value)} autoComplete="new-password" />{msg("pw2")}</label></>}

      <button className="btn big" disabled={busy}>{busy ? "Please wait…" : signup ? "Sign up" : "Log in"}</button>
      {tried && Object.keys(e).length > 0 && <p className="error" role="alert">Please fix the {Object.keys(e).length} highlighted {Object.keys(e).length === 1 ? "field" : "fields"} above.</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <p className="muted small">{signup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Sign up</Link></>} · <Link to="/planner">Continue as guest</Link></p>
    </form></main>
  );
}
