export function coerceInt(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function coerceFloat(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export function coerceBool(v) {
  if (v == null) return false;
  return String(v).trim().toUpperCase() === 'Y';
}
