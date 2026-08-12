import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// Relative paths are normalised to forward slashes so the assertion messages
// and set comparison are identical on Windows and Linux. The original CI gap
// hid behind a Windows-only local run; nothing here may depend on `sep`.
function listJs(root) {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js')) out.push(relative(root, p).split(sep).join('/'));
    }
  })(root);
  return out.sort();
}

describe('dist/ smoke', () => {
  it('imports parseXer from dist and parses a minimal XER', async () => {
    const lib = await import('../../dist/index.js');
    const xer = ['ERMHDR\t24.12\t2024-01-15\tx\ty\tz', '%T\tA', '%F\ta', '%R\t1', '%E'].join('\n');
    const m = lib.parseXer(xer);
    expect(m.tables.A.records[0].a).toBe('1');
  });

  it('public API surface available from dist', async () => {
    const lib = await import('../../dist/index.js');
    expect(typeof lib.parseXer).toBe('function');
    expect(typeof lib.writeXer).toBe('function');
    expect(typeof lib.getTable).toBe('function');
    expect(typeof lib.buildWbsMap).toBe('function');
  });

  // scripts/bundle.mjs is a plain recursive copy, so a STALE dist/ still
  // imports cleanly and passes both smoke tests above while diverging from the
  // src/ it is supposed to mirror. The two tests above prove dist/ runs; this
  // one proves it is the current src/. It also guards the regression
  // bundle.mjs's own comment warns about — a hardcoded file list that silently
  // drops nested modules (parse-p6xml.js, encoding/gzip.js).
  it('dist/ mirrors src/ exactly (no stale or dropped modules)', () => {
    expect(
      existsSync(DIST),
      'dist/ is missing — run `npm run build` (node scripts/bundle.mjs)'
    ).toBe(true);

    const srcFiles = listJs(SRC);
    const distFiles = listJs(DIST);

    // Set equality catches both directions: a src/ module absent from dist/,
    // and a deleted src/ module still lingering in dist/.
    expect(distFiles).toEqual(srcFiles);
    expect(distFiles.length).toBe(srcFiles.length);
    expect(srcFiles.length).toBeGreaterThan(0);

    // Content equality catches the stale-copy case the imports cannot see.
    for (const rel of srcFiles) {
      const srcText = readFileSync(join(SRC, rel), 'utf-8');
      const distText = readFileSync(join(DIST, rel), 'utf-8');
      expect(
        distText,
        `dist/${rel} is stale relative to src/${rel} — run \`npm run build\``
      ).toBe(srcText);
    }
  });
});
