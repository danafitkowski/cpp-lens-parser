/**
 * predecessors.js — predecessor/successor relationship builder
 *
 * Mirrors build_predecessor_map at xer_parser.py:912-925.
 *
 * Groups TASKPRED records into two parallel indexes:
 *   predecessors: task_id      → [TASKPRED records where this task is the successor]
 *   successors:   pred_task_id → [TASKPRED records where this task is the predecessor]
 *
 * The Python returns a `(predecessors, successors)` tuple; JS returns an
 * object `{ predecessors, successors }` so destructuring is explicit and
 * the call site doesn't depend on positional ordering.
 */

import { getTable } from '../access.js';

/**
 * Build predecessor and successor lookups from the TASKPRED table.
 *
 * @param {object|null|undefined} model  Output of parseXer().
 * @returns {{ predecessors: Record<string,object[]>, successors: Record<string,object[]> }}
 *   Both maps are plain objects; absent keys return undefined (not []).
 */
export function buildPredecessorMap(model) {
  const preds = getTable(model, 'TASKPRED');

  /** @type {Record<string, object[]>} */
  const predecessors = {};
  /** @type {Record<string, object[]>} */
  const successors = {};

  for (const p of preds) {
    const taskId     = p.task_id      || '';
    const predTaskId = p.pred_task_id || '';

    // predecessors index: "which tasks come before taskId?"
    if (!predecessors[taskId]) predecessors[taskId] = [];
    predecessors[taskId].push(p);

    // successors index: "which tasks come after predTaskId?"
    if (!successors[predTaskId]) successors[predTaskId] = [];
    successors[predTaskId].push(p);
  }

  return { predecessors, successors };
}
