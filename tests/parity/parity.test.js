import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { runPythonParser } from './run-python.mjs';
import { firstDiff } from './diff-model.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '..', 'fixtures');

const fixtures = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.xer'));

describe('parity against Python parse_xer', () => {
  // The loop below is generated from a directory listing, so a missing fixture
  // silently shrinks this suite instead of failing it. Parity is excluded from
  // CI by design, so that drift can only ever be caught here — pin the set.
  // large-synthetic.xer is generated, not committed (.gitignore line 6);
  // `npm run test:parity` generates it first. Adding a fixture is expected to
  // fail this test once, deliberately: bump the count with the new file.
  it('enumerates the full fixture set (generated fixtures present)', () => {
    expect(
      fixtures,
      'large-synthetic.xer is missing — run `npm run fixtures`'
    ).toContain('large-synthetic.xer');
    expect(fixtures.length).toBe(9);
  });

  for (const fixture of fixtures) {
    it(`${fixture} — JS model matches Python model`, () => {
      const fixturePath = join(FIXTURE_DIR, fixture);
      const text = readFileSync(fixturePath, 'utf-8');
      const jsModel = parseXer(text);
      const pyModel = runPythonParser(fixturePath);

      // We compare only ermhdr + tables (the Python emitter already strips
      // filepath/filename/parse_timestamp/encoding_used).
      const jsCompare = {
        ermhdr: jsModel.ermhdr,
        tables: jsModel.tables
      };

      const diff = firstDiff(jsCompare, pyModel);
      if (diff) {
        throw new Error(`Parity divergence in ${fixture} at ${diff}`);
      }
    });
  }
});
