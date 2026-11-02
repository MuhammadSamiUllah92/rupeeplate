const hdr = () => { const t = localStorage.getItem("rupeeplate-token"); return { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }; };
async function go(method, path, body) {
  const r = await fetch("/api" + path, { method, headers: hdr(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    let m = ""; try { const j = await r.json(); m = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => `${String(d.loc?.[d.loc.length - 1] ?? "").replace(/_/g, " ")}: ${String(d.msg).replace(/^Value error, /, "")}`).join(" ") : ""; } catch {}
    throw new Error(m || (r.status === 422 ? "Please check the numbers you entered." : "The server could not do that. Is the API running?"));
  }
  return r.json();
}
export const post = (p, b) => go("POST", p, b);
export const get = (p) => go("GET", p);
export const del = (p) => go("DELETE", p);
export const rs = (n) => "Rs " + Math.round(n).toLocaleString("en-PK");
