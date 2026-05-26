import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gzipText, gunzipText, gzipToBase64, gunzipFromBase64,
} from '../../src/encoding/gzip.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

const SAMPLE_XER = readFileSync(join(FIX, 'minimal-3-task.xer'), 'utf-8');
const LARGE_XER = readFileSync(join(FIX, 'large-synthetic.xer'), 'utf-8');

describe('gzip helpers', () => {
  it('round-trips text through gzipText / gunzipText', async () => {
    const compressed = await gzipText(SAMPLE_XER);
    expect(compressed).toBeInstanceOf(Uint8Array);
    // gzip magic bytes 0x1f 0x8b at start.
    expect(compressed[0]).toBe(0x1f);
    expect(compressed[1]).toBe(0x8b);
    const back = await gunzipText(compressed);
    expect(back).toBe(SAMPLE_XER);
  });

  it('round-trips through gzipToBase64 / gunzipFromBase64', async () => {
    const b64 = await gzipToBase64(SAMPLE_XER);
    expect(typeof b64).toBe('string');
    // Base64 alphabet only.
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);
    const back = await gunzipFromBase64(b64);
    expect(back).toBe(SAMPLE_XER);
  });

  it('shrinks the wire payload substantially for repetitive XER text', async () => {
    const original_kb = LARGE_XER.length / 1024;
    const b64 = await gzipToBase64(LARGE_XER);
    const wire_kb = b64.length / 1024;
    // XER is highly repetitive TSV — gzip should easily beat 50% of the
    // raw-base64 size. The raw-base64 size would be ~133% of original
    // (base64 33% overhead); gzip+base64 typically lands at 15-25%.
    expect(wire_kb).toBeLessThan(original_kb * 0.5);
  });

  it('handles empty string', async () => {
    const compressed = await gzipText('');
    const back = await gunzipText(compressed);
    expect(back).toBe('');
  });

  it('handles Unicode (non-ASCII activity names)', async () => {
    const text = 'ERMHDR\t24.12\nProjet — Démarrage\n%T\tTASK\n';
    const compressed = await gzipText(text);
    const back = await gunzipText(compressed);
    expect(back).toBe(text);
  });
});
