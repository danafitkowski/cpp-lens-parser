import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures', 'large-synthetic.xer');

describe('parse performance', () => {
  it('5000-activity synthetic parses within budget', () => {
    // Hard filesystem precondition, asserted rather than left to surface as a
    // bare ENOENT from readFileSync: the fixture is generated, not committed
    // (.gitignore line 6), so a fresh clone does not have it. Fail with the
    // command that fixes it.
    expect(
      existsSync(FIX),
      'tests/fixtures/large-synthetic.xer is missing — run `npm run fixtures` '
        + '(node scripts/gen-large-fixture.mjs, default 5000 activities)'
    ).toBe(true);

    // Assert the workload size independently of parse success, so a truncated
    // or small-N fixture cannot make the timing below look good. The
    // deterministic generator output is 724,774 bytes at the default N=5000.
    expect(statSync(FIX).size).toBeGreaterThan(700_000);

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
