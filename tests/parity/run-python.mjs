import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Invoke the Python parser on a fixture file. Returns the parsed canonical
 * { ermhdr, tables } object. Throws if Python fails.
 *
 * @param {string} fixturePath - absolute path to a .xer file
 * @returns {object}
 */
export function runPythonParser(fixturePath) {
  const script = join(__dirname, 'python_emit.py');
  const result = spawnSync('python', [script, fixturePath], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`Python parser failed (exit ${result.status}): ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}
