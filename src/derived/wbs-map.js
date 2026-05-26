/**
 * wbs-map.js — WBS hierarchy lookup builder
 *
 * Mirrors build_wbs_map at xer_parser.py:853-888.
 *
 * Builds a flat wbs_id → record map and enriches each record with
 * `_full_path`: a breadcrumb string of all ancestor wbs_name values
 * separated by ' > ', e.g. "Root > Civil > Foundation".
 *
 * Cycle detection: if the parent_wbs_id chain loops back to a node
 * already visited in the current ancestry walk, a `ValueError`-equivalent
 * is thrown. This is a genuine data corruption guard, not a redundancy
 * check — a cycle means the WBS tree cannot be rendered or compared.
 */

import { getTable } from '../access.js';

/**
 * Build a wbs_id → enriched-WBS-record map from a parsed XER model.
 *
 * Each returned record is the raw PROJWBS record (mutated in-place) with
 * an added `_full_path` string property.
 *
 * @param {object|null|undefined} model  Output of parseXer().
 * @returns {Record<string, object>}  Empty object when PROJWBS is absent.
 * @throws {Error}  When a circular parent_wbs_id chain is detected.
 */
export function buildWbsMap(model) {
  const wbsRecords = getTable(model, 'PROJWBS');
  /** @type {Record<string, object>} */
  const wbsMap = {};

  for (const wbs of wbsRecords) {
    const wbsId = wbs.wbs_id || '';
    if (wbsId) {
      wbsMap[wbsId] = wbs;
    }
  }

  /**
   * Recursively resolve the full path for a given wbs_id.
   * `visited` tracks the ids seen in the current ancestry chain so that
   * a back-edge (cycle) can be detected and reported immediately.
   *
   * @param {string} wbsId
   * @param {Set<string>} visited  Ids already on the current ancestry walk.
   * @returns {string}
   */
  function getPath(wbsId, visited = new Set()) {
    if (!wbsId || !(wbsId in wbsMap)) return '';
    if (visited.has(wbsId)) {
      throw new Error(
        `Circular WBS hierarchy detected at wbs_id=${JSON.stringify(wbsId)}; ` +
        `visited=${JSON.stringify([...visited].sort())}`
      );
    }
    visited.add(wbsId);
    const wbs = wbsMap[wbsId];
    const parentId = wbs.parent_wbs_id || '';
    const parentPath = getPath(parentId, visited);
    const name = wbs.wbs_name || wbs.wbs_short_name || '';
    return parentPath ? `${parentPath} > ${name}` : name;
  }

  for (const wbsId of Object.keys(wbsMap)) {
    wbsMap[wbsId]._full_path = getPath(wbsId);
  }

  return wbsMap;
}
