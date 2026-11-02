import { createContext, useContext, useEffect, useState } from "react";
import { get, post } from "./api.js";
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [name, setName] = useState(""), [profile, setProfile] = useState(null);
  useEffect(() => { if (localStorage.getItem("rupeeplate-token")) get("/auth/me").then((u) => { setUser(u.email); setName(u.name); setProfile(u); }).catch(() => localStorage.removeItem("rupeeplate-token")); }, []);
  const enter = async (mode, payload) => { const r = await post("/auth/" + mode, payload); localStorage.setItem("rupeeplate-token", r.token); setUser(r.email); setName(r.name || ""); setProfile(r); };
  const logout = () => { localStorage.removeItem("rupeeplate-token"); setUser(null); setName(""); setProfile(null); };
  return <Ctx.Provider value={{ user, name, profile, enter, logout }}>{children}</Ctx.Provider>;
}
