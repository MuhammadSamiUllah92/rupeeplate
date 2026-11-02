import { useEffect } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Planner from "./pages/Planner.jsx";
import Auth from "./pages/Auth.jsx";
import Saved from "./pages/Saved.jsx";
import Progress from "./pages/Progress.jsx";
import Feedback from "./pages/Feedback.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { Recipes, RecipeDetail } from "./pages/Recipes.jsx";
import Help from "./pages/Help.jsx";
import { get } from "./api.js";
import { useState } from "react";
import { useAuth } from "./auth.jsx";

export default function App() {
  const { pathname, hash } = useLocation();
  const { user, name, logout } = useAuth();
  const [due, setDue] = useState(null);
  useEffect(() => { if (user) get("/progress").then((s) => setDue(s.due ? s : null)).catch(() => setDue(null)); else setDue(null); }, [user, pathname]);
  useEffect(() => { if (!hash) window.scrollTo(0, 0); else document.querySelector(hash)?.scrollIntoView(); }, [pathname, hash]);
  return (
    <>
      <header className="nav"><div className="wrap nav-in">
        <Link to="/" className="logo"><span className="logo-mark">₨</span>RupeePlate</Link>
        <nav className="links">
          {user ? <NavLink to="/" end>Home</NavLink> : <><Link to="/#how">How it works</Link><Link to="/#features">Features</Link></>}
          <NavLink to="/planner">Meal plan</NavLink><NavLink to="/recipes">Recipes</NavLink>
          {user && <><NavLink to="/progress">Progress</NavLink><NavLink to="/saved">Saved plans</NavLink></>}
          <NavLink to="/help">Help</NavLink>
        </nav>
        <div className="actions">{user ? <><span className="who muted small">Hi, {(name || user).split(" ")[0]}</span><button className="btn ghost" onClick={logout}>Log out</button></> : <><Link className="btn ghost" to="/login">Log in</Link><Link className="btn" to="/signup">Sign up</Link></>}</div>
      </div></header>
      {due && pathname !== "/progress" && <div className="due-bar"><div className="wrap">👋 Welcome back! It has been {due.days_since} days since your {due.plan.goal_name} plan. <Link to="/progress">Check in now to see your progress →</Link></div></div>}
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <Home />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/fast-food" element={<Navigate to="/planner" replace />} />
        <Route path="/help" element={<Help />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/exercise" element={<Navigate to="/planner" replace />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
      </Routes>
      <footer className="foot"><div className="wrap">
        <b>RupeePlate</b> · A semester project by Muhammad Sami Ullah, UCP. Prices and nutrition values are approximate. Not medical advice. · <Link to="/feedback">Send feedback</Link>
      </div></footer>
    </>
  );
}
