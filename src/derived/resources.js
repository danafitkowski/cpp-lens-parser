/**
 * resources.js — task resource assignment builder
 *
 * Mirrors build_resource_map at xer_parser.py:891-909.
 *
 * Joins TASKRSRC with RSRC by rsrc_id and groups by task_id.
 * Each assignment record in the returned map is the raw TASKRSRC record
 * spread-merged with two enrichment properties:
 *   _rsrc_name       — RSRC.rsrc_name ('' when rsrc_id not found in RSRC)
 *   _rsrc_short_name — RSRC.rsrc_short_name ('' when rsrc_id not found)
 */

import { getTable } from '../access.js';

/**
 * Build a task_id → list-of-resource-assignment-records map.
 *
 * @param {object|null|undefined} model  Output of parseXer().
 * @returns {Record<string, object[]>}  Empty object when TASKRSRC is absent.
 */
export function buildResourceMap(model) {
  const taskrsrc = getTable(model, 'TASKRSRC');
  const rsrc     = getTable(model, 'RSRC');

  // RSRC lookup by rsrc_id
  /** @type {Record<string, object>} */
  const rsrcLookup = {};
  for (const r of rsrc) {
    const rsrcId = r.rsrc_id || '';
    if (rsrcId) rsrcLookup[rsrcId] = r;
  }

  /** @type {Record<string, object[]>} */
  const taskResources = {};

  for (const tr of taskrsrc) {
    const taskId  = tr.task_id  || '';
    const rsrcId  = tr.rsrc_id  || '';
    const rsrcRec = rsrcLookup[rsrcId] || {};

    const combined = {
      ...tr,
      _rsrc_name:       rsrcRec.rsrc_name       || '',
      _rsrc_short_name: rsrcRec.rsrc_short_name || '',
    };

    if (!taskResources[taskId]) taskResources[taskId] = [];
    taskResources[taskId].push(combined);
  }

  return taskResources;
}
