/**
 * LensModel — canonical empty-model factory.
 *
 * Every downstream parser, writer, and view starts from this shape.
 * The shape mirrors the Python XerProject from xer_parser.py at the top level.
 *
 * Documented deviations from the design spec:
 *   - memoTypes and memos are top-level (not under derived): they are first-class
 *     table data, not derived values.
 *   - meta.isHalfStep is present in the shape but is NEVER auto-set by the parser.
 *     Callers (e.g. the Lens browser app) set it when they know the file was produced
 *     by a Half-Step generation function. Default: false.
 */
export function createEmptyModel() {
  return {
    meta: {
      source: null,
      sha256: null,
      parsedAt: null,
      isHalfStep: false,
      fileSizeBytes: 0
    },
    projects: [],
    calendars: [],
    wbs: null,
    activities: [],
    relationships: [],
    resources: [],
    assignments: [],
    codes: { types: [], values: [], taskLinks: [] },
    udfs: { types: [], values: [] },
    memoTypes: [],
    memos: [],
    derived: {}
  };
}
