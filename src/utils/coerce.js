export function coerceInt(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function coerceFloat(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function coerceBool(v) {
  if (v == null) return false;
  return String(v).trim().toUpperCase() === 'Y';
}
