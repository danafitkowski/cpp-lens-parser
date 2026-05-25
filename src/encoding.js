/**
 * Detect a Unicode BOM at the start of a byte buffer.
 *
 * Returns one of: 'utf-8-sig', 'utf-16-le', 'utf-16-be', 'utf-32-le',
 * 'utf-32-be', or null.
 *
 * Ports `_detect_bom_encoding` from
 * ~/.claude/skills/xer-parser/scripts/xer_parser.py:202-224.
 *
 * Order matters: UTF-32 LE BOM is `FF FE 00 00`, which starts with the
 * same `FF FE` as UTF-16 LE — check the 4-byte UTF-32 patterns BEFORE
 * the 2-byte UTF-16 patterns.
 *
 * @param {Uint8Array | null | undefined} bytes  At least the first 4 bytes
 *   of the file. Returns null if input is missing or shorter than 2 bytes.
 * @returns {string | null}
 */
export function detectBomEncoding(bytes) {
  if (!bytes || bytes.length < 2) return null;
  const b0 = bytes[0];
  const b1 = bytes[1];
  const b2 = bytes.length > 2 ? bytes[2] : -1;
  const b3 = bytes.length > 3 ? bytes[3] : -1;
  if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) return 'utf-8-sig';
  if (b0 === 0xff && b1 === 0xfe && b2 === 0x00 && b3 === 0x00) return 'utf-32-le';
  if (b0 === 0x00 && b1 === 0x00 && b2 === 0xfe && b3 === 0xff) return 'utf-32-be';
  if (b0 === 0xff && b1 === 0xfe) return 'utf-16-le';
  if (b0 === 0xfe && b1 === 0xff) return 'utf-16-be';
  return null;
}
