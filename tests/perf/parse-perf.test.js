import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures', 'large-synthetic.xer');

describe('parse performance', () => {
  it('5000-activity synthetic parses within budget', () => {
    const text = readFileSync(FIX, 'utf-8');
    const bytes = statSync(FIX).size;
    const t0 = performance.now();
    const m = parseXer(text);
    const dt = performance.now() - t0;
    console.log(`Parsed ${(bytes/1024/1024).toFixed(2)} MB / ${m.tables.TASK.records.length} activities in ${dt.toFixed(1)} ms`);
    expect(dt).toBeLessThan(8000);
    expect(m.tables.TASK.records.length).toBe(5000);
  });
});
