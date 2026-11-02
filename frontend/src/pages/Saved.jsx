import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Results from "./Results.jsx";
import { del, get, rs } from "../api.js";
import { useAuth } from "../auth.jsx";

export default function Saved() {
  const { user } = useAuth();
  const [list, setList] = useState([]), [open, setOpen] = useState(null), [day, setDay] = useState(0);
  useEffect(() => {
    if (user) get("/plans").then(setList).catch(() => setList([]));
    else setList(JSON.parse(localStorage.getItem("rupeeplate-saved2") || "[]"));
  }, [user]);
  async function remove(id) {
    if (user) await del("/plans/" + id).catch(() => {});
    else localStorage.setItem("rupeeplate-saved2", JSON.stringify(list.filter((x) => x.id !== id)));
    setList(list.filter((x) => x.id !== id)); if (open?.id === id) setOpen(null);
  }
  return (<main className="wrap planner"><h1>Saved plans</h1>
    <p className="muted">{user ? `Saved to your account (${user}), available on every device.` : <>Saved in this browser only. <Link to="/signup">Create an account</Link> to keep plans on every device.</>}</p>
    {!list.length && <div className="card empty"><h3>No saved plans yet</h3><p className="muted">Build a plan and press “Save”.</p><Link className="btn" to="/planner">Make a plan</Link></div>}
    <div>{list.map((x) => (<div className="card saved" key={x.id}><div><b>{x.date}</b><span className="muted"> · {x.res.plan.days.length} days · {rs(x.res.plan.average_daily_cost)}/day · {x.res.t.kcal} kcal</span></div>
      <div><button className="btn ghost" onClick={() => { setOpen(x); setDay(0); }}>Open</button> <button className="btn ghost" onClick={() => remove(x.id)}>Delete</button></div></div>))}</div>
    {open && <div style={{ marginTop: 20 }}><Results res={open.res} day={day} setDay={setDay} readonly /></div>}
  </main>);
}
