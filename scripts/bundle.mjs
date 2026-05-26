import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'dist');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const files = [
  'index.js', 'lens-model.js', 'parse-xer.js', 'write-xer.js', 'access.js', 'encoding.js', 'worker-parse.js',
  'utils/tables.js', 'utils/dates.js', 'utils/coerce.js', 'utils/header.js',
  'derived/calendars.js', 'derived/wbs-map.js', 'derived/predecessors.js',
  'derived/resources.js', 'derived/activity-codes.js', 'derived/udfs.js'
];
for (const f of files) {
  const src = join(ROOT, 'src', f);
  const dst = join(OUT, f);
  if (!existsSync(src)) continue;  // skip missing optional files
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, readFileSync(src, 'utf-8'));
}
console.log(`Copied ${files.length} source files to dist/`);
