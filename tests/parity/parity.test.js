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
