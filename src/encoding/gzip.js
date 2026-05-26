/**
 * Gzip helpers for the Lens upload path.
 *
 * The /lens/run facade accepts XER payloads as base64; for large XERs the
 * uncompressed wire size is the bottleneck (~70-90 KB per typical EPC
 * schedule, multiplied by base64's 33% overhead). Gzip shrinks it ~80%
 * because XER is highly repetitive TSV text.
 *
 * Used by the Lens viewer at upload time and the dispatcher's
 * `_decode_xer_to_tempfile` server-side counterpart (which sniffs the
 * gzip magic 0x1f 0x8b at the front of the decoded base64 bytes).
 *
 * `pako` is the de-facto pure-JS gzip implementation (~45 KB minified,
 * MIT licensed, zero dependencies, ~5x faster than alternatives on browser
 * engines). Loaded lazily so callers that don't compress don't pay the
 * bundle cost — the rest of `@criticalpathpartners/lens-parser` stays
 * dependency-free.
 */

let _pako = null;

async function loadPako() {
  if (_pako) return _pako;
  // Dynamic import keeps the rest of the parser zero-dep when pako isn't used.
  _pako = await import('pako');
  return _pako;
}

/**
 * Gzip-compress text and return the raw byte array.
 *
 * @param {string} text
 * @returns {Promise<Uint8Array>}
 */
export async function gzipText(text) {
  const pako = await loadPako();
  // Encode to UTF-8 bytes first so multi-byte characters (cp1252 fallback
  // characters, P6's Unicode activity names) survive round-trip.
  const bytes = new TextEncoder().encode(text);
  return pako.gzip(bytes);
}

/**
 * Ungzip a byte array back into text. Mirror of `gzipText`.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<string>}
 */
export async function gunzipText(bytes) {
  const pako = await loadPako();
  const out = pako.ungzip(bytes);
  return new TextDecoder('utf-8').decode(out);
}

/**
 * Convenience: gzip text + return as base64 string ready for JSON wire transport.
 * Mirrors the wire format the /lens/run facade dispatcher expects on its
 * `xer_base64` field (gzip + base64 is auto-detected server-side via the
 * 0x1f 0x8b magic at the head of the decoded bytes).
 *
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function gzipToBase64(text) {
  const bytes = await gzipText(text);
  return bytesToBase64(bytes);
}

/**
 * Inverse of gzipToBase64 — base64 → ungzip → text.
 *
 * @param {string} b64
 * @returns {Promise<string>}
 */
export async function gunzipFromBase64(b64) {
  const bytes = base64ToBytes(b64);
  return gunzipText(bytes);
}

// ── Base64 helpers (chunked to survive multi-MB payloads) ──────────────────
function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  // btoa is available in browsers and Node 16+.
  if (typeof btoa !== 'undefined') return btoa(binary);
  // Node-only fallback.
  return Buffer.from(binary, 'binary').toString('base64');
}

function base64ToBytes(b64) {
  if (typeof atob !== 'undefined') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
