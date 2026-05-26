import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXer } from '../../src/parse-xer.js';
import { buildPredecessorMap } from '../../src/derived/predecessors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIX = join(__dirname, '..', 'fixtures');

function loadFixture(name) {
  return parseXer(readFileSync(join(FIX, name), 'utf-8'));
}

describe('buildPredecessorMap', () => {
  // ── return shape ──────────────────────────────────────────────────────────

  it('returns an object with predecessors and successors keys', () => {
    const model = loadFixture('minimal-3-task.xer');
    const result = buildPredecessorMap(model);
    expect(result).toHaveProperty('predecessors');
    expect(result).toHaveProperty('successors');
  });

  // ── minimal-3-task.xer: single FS link 1→2 ───────────────────────────────

  it('predecessor of task 2 is task 1 (minimal-3-task FS link)', () => {
    const model = loadFixture('minimal-3-task.xer');
    const { predecessors } = buildPredecessorMap(model);
    expect(Array.isArray(predecessors['2'])).toBe(true);
    expect(predecessors['2'].length).toBe(1);
    expect(predecessors['2'][0].pred_task_id).toBe('1');
  });

  it('successor of task 1 is task 2 (minimal-3-task FS link)', () => {
    const model = loadFixture('minimal-3-task.xer');
    const { successors } = buildPredecessorMap(model);
    expect(Array.isArray(successors['1'])).toBe(true);
    expect(successors['1'].length).toBe(1);
    expect(successors['1'][0].task_id).toBe('2');
  });

  it('task 1 has no predecessors (it is the first task)', () => {
    const model = loadFixture('minimal-3-task.xer');
    const { predecessors } = buildPredecessorMap(model);
    expect(predecessors['1']).toBeUndefined();
  });

  it('task 2 has no successors (it is the last task)', () => {
    const model = loadFixture('minimal-3-task.xer');
    const { successors } = buildPredecessorMap(model);
    expect(successors['2']).toBeUndefined();
  });

  it('predecessor records include pred_type field', () => {
    const model = loadFixture('minimal-3-task.xer');
    const { predecessors } = buildPredecessorMap(model);
    expect(predecessors['2'][0]).toHaveProperty('pred_type', 'PR_FS');
  });

  // ── progress-states.xer: two-link chain T1→T2→T3 ────────────────────────

  it('handles multi-link chain: T2 has one predecessor (T1) and one successor (T3)', () => {
    const model = loadFixture('progress-states.xer');
    const { predecessors, successors } = buildPredecessorMap(model);
    expect(predecessors['T2'].length).toBe(1);
    expect(predecessors['T2'][0].pred_task_id).toBe('T1');
    expect(successors['T2'].length).toBe(1);
    expect(successors['T2'][0].task_id).toBe('T3');
  });

  it('T1 has no predecessors in progress-states fixture', () => {
    const model = loadFixture('progress-states.xer');
    const { predecessors } = buildPredecessorMap(model);
    expect(predecessors['T1']).toBeUndefined();
  });

  // ── negative-lag.xer ─────────────────────────────────────────────────────

  it('handles negative-lag fixture without error', () => {
    const model = loadFixture('negative-lag.xer');
    const { predecessors, successors } = buildPredecessorMap(model);
    expect(typeof predecessors).toBe('object');
    expect(typeof successors).toBe('object');
  });

  // ── edge case: empty/absent TASKPRED ─────────────────────────────────────

  it('returns empty maps when model has no TASKPRED table', () => {
    const { predecessors, successors } = buildPredecessorMap({ tables: {} });
    expect(predecessors).toEqual({});
    expect(successors).toEqual({});
  });

  it('returns empty maps for null model', () => {
    const { predecessors, successors } = buildPredecessorMap(null);
    expect(predecessors).toEqual({});
    expect(successors).toEqual({});
  });

  // ── multiple predecessors ────────────────────────────────────────────────

  it('accumulates multiple predecessors into an array for the same task', () => {
    const model = {
      tables: {
        TASKPRED: {
          fields: ['task_pred_id', 'task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'],
          records: [
            { task_pred_id: '1', task_id: 'C', pred_task_id: 'A', pred_type: 'PR_FS', lag_hr_cnt: '0' },
            { task_pred_id: '2', task_id: 'C', pred_task_id: 'B', pred_type: 'PR_FS', lag_hr_cnt: '0' },
          ],
        },
      },
    };
    const { predecessors, successors } = buildPredecessorMap(model);
    expect(predecessors['C'].length).toBe(2);
    expect(successors['A'].length).toBe(1);
    expect(successors['B'].length).toBe(1);
  });
});
