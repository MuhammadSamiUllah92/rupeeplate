export const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const NAME = /^[A-Za-z][A-Za-z .'-]{1,59}$/;
export const pwChecks = (p) => [[p.length >= 8, "At least 8 characters"], [/[A-Z]/.test(p), "An uppercase letter"], [/[a-z]/.test(p), "A lowercase letter"], [/\d/.test(p), "A number"], [/[^A-Za-z0-9\s]/.test(p), "A symbol such as ! @ # $"], [!/\s/.test(p), "No spaces"]];
export const cleanInt = (v) => String(v).replace(/\D/g, "").slice(0, 4);
export const cleanDec = (v) => { let s = String(v).replace(/[^\d.]/g, ""); const i = s.indexOf("."); if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "").slice(0, 1); return s.slice(0, 6); };
// Returns an error message or "" for a numeric field.
export function numErr(v, label, lo, hi, int = false, required = true) {
  if (v === "" || v == null) return required ? `${label} is required.` : "";
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (int && !Number.isInteger(n)) return `${label} must be a whole number.`;
  if (n < lo || n > hi) return `${label} must be between ${lo} and ${hi}.`;
  return "";
}

// Age in whole years from an ISO date string (YYYY-MM-DD). Returns null for a bad or impossible date.
export function ageFrom(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return null;
  const [y, m, d] = iso.split("-").map(Number), dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const t = new Date(); let a = t.getFullYear() - y;
  if (t.getMonth() < m - 1 || (t.getMonth() === m - 1 && t.getDate() < d)) a--;
  return a;
}
export const isoYearsAgo = (n) => { const t = new Date(); t.setFullYear(t.getFullYear() - n); return t.toISOString().slice(0, 10); };
export function dobErr(v) {
  if (!v) return "Date of birth is required.";
  const a = ageFrom(v);
  if (a === null) return "Enter a real date of birth.";
  if (new Date(v) > new Date()) return "Date of birth cannot be in the future.";
  if (a < 18) return "You must be at least 18 years old to sign up.";
  if (a > 80) return "Age must be 80 or below.";
  return "";
}
