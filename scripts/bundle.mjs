import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// Recursively collect EVERY .js under src/ so dist/ always mirrors the full
// module graph. A hardcoded file list previously dropped nested modules
// (parse-p6xml.js, encoding/gzip.js), leaving dist/ with broken imports that
// only the browser smoke test caught. Never reintroduce a manual list.
function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(SRC);
for (const src of files) {
  const rel = relative(SRC, src);
  const dst = join(OUT, rel);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, readFileSync(src, 'utf-8'));
}
console.log(`Copied ${files.length} source files to dist/ (recursive walk of src/)`);
