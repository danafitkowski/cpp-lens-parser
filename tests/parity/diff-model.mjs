/**
 * Deep-equality comparison that returns the first divergence as a string,
 * or null if equal. Used by the parity test to produce actionable error
 * messages instead of "expected X to equal Y" with giant blob diffs.
 *
 * @returns {string | null}
 */
export function firstDiff(a, b, path = '') {
  if (a === b) return null;
  if (typeof a !== typeof b) return `${path}: type mismatch (js=${typeof a}, py=${typeof b})`;
  if (a == null || b == null) {
    if (a !== b) return `${path}: null mismatch (js=${a}, py=${b})`;
    return null;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return `${path}: array vs non-array`;
    }
    if (a.length !== b.length) {
      return `${path}.length: js=${a.length} py=${b.length}`;
    }
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (typeof a === 'object') {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) {
      const onlyA = aKeys.filter(k => !bKeys.includes(k));
      const onlyB = bKeys.filter(k => !aKeys.includes(k));
      return `${path}: key mismatch (only-in-js=${JSON.stringify(onlyA)}, only-in-py=${JSON.stringify(onlyB)})`;
    }
    for (const k of aKeys) {
      const d = firstDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return `${path}: value mismatch (js=${JSON.stringify(a).slice(0,80)}, py=${JSON.stringify(b).slice(0,80)})`;
}
