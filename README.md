# @criticalpathpartners/lens-parser

JavaScript reader and writer for Primavera P6 XER files. Pure ES modules, browser-compatible, zero runtime dependencies.

Companion to [cpp-cpm-engine](https://github.com/danafitkowski/cpp-cpm-engine) and powers the CPP Lens browser viewer at https://criticalpathpartners.ca/viewer/.

## Status

v0.2.0 — alias-aware table access, multi-name field fallback, opt-in rawText.

## Install

```bash
npm install @criticalpathpartners/lens-parser
```

## Usage

```javascript
import {
  parseXer, writeXer,
  getTable, getFields,
  getTableAliased, getFirstField, TABLE_ALIASES,
  buildWbsMap, buildPredecessorMap, buildResourceMap, buildActivityCodeMap, buildUdfMap,
  getCalendarMap, addWorkDays, subtractWorkDays, getWorkDaysBetween, durationHoursToDays
} from '@criticalpathpartners/lens-parser';

// Read an XER file
const xerText = await fetch('/schedule.xer').then(r => r.text());
const model = parseXer(xerText, { filename: 'schedule.xer' });

// Access tables — canonical name
const tasks = getTable(model, 'TASK');
const taskFields = getFields(model, 'TASK');

// Access tables — alias-aware (works with non-canonical P6 export variants)
const wbsRecords = getTableAliased(model, 'WBS');    // resolves to PROJWBS
const preds      = getTableAliased(model, 'REL');    // resolves to TASKPRED
const assigns    = getTableAliased(model, 'ASSIGN'); // resolves to TASKRSRC

// Normalize field-name variants across P6 export versions
const taskId = getFirstField(tasks[0], ['task_id', 'task_code']);
const wbsName = getFirstField(wbsRecords[0], ['wbs_name', 'wbs_short_name']);

// Build derived lookups
const wbsMap = buildWbsMap(model);          // wbs_id -> wbs record with _full_path
const { predecessors, successors } = buildPredecessorMap(model);
const calendars = getCalendarMap(model);    // clndr_id -> parsed calendar info

// Calendar arithmetic
const finish = addWorkDays('2024-01-15', 10, calendars['1']);  // adds 10 work days
const workDays = getWorkDaysBetween('2024-01-15', '2024-02-15', calendars['1']);

// Edit the model
tasks[0].task_name = 'Renamed activity';

// Write back to XER text
const updatedXer = writeXer(model);
```

## Model shape

`parseXer` returns the canonical Python parser shape:

```javascript
{
  ermhdr: {
    raw, version, export_date, user, database, currency
  },
  tables: {
    TABLE_NAME: {
      fields:  ['field1', 'field2', ...],
      records: [{ field1: '<string>', field2: '<string>', ... }, ...]
    }
  },
  filepath, filename, parse_timestamp, encoding_used
}
```

**Every record value is a string** — no type coercion at parse time. Type-aware operations live in derived helpers (`buildWbsMap`, calendar arithmetic, etc.) that work on the raw string data.

## Half-Step XER

`model.ermhdr.isHalfStep` is reserved for use by callers who know the file was produced by a Half-Step generation (AACE 29R-03 MIP 3.4). The parser does NOT auto-detect — Half-Step is a property of generation provenance, not file contents. The generator function itself is provided by the companion Python skill.

## Parity

Every fixture in `tests/fixtures/` is parsed by both this library and the canonical Python `xer-parser` skill; the resulting models are diffed and any divergence fails the build. Run:

```bash
npm run test:parity
```

Round-trip writer fidelity is verified: every fixture passes `parseXer(writeXer(parseXer(text)))` byte-identical at the `ermhdr` + `tables` level.

## What's new in 0.2

- **`getTableAliased(model, alias)`** — resolves logical names (`WBS`, `REL`, `ASSIGN`, `CAL`, `COST`, etc.) to their canonical P6 table names via the exported `TABLE_ALIASES` map. Falls back to a direct lookup when the name isn't in the map, so it's a safe drop-in for `getTable`.
- **`getFirstField(record, keys)`** — returns the first non-empty value from a record across an ordered list of candidate key names. Handles the `task_id` / `task_code`, `wbs_name` / `wbs_short_name`, `pred_type` / `rel_type` variants common across P6 export generations. Null and empty-string are treated as missing; numeric zero and `'0'` are real values.
- **`parseXer(text, { keepRawText: true })`** — opt-in flag that stores the original input text on `model.rawText`. Off by default (XERs can be large). Needed by utilities like POBS Cleaner that re-emit a modified version of the original bytes.

## Test count

230 unit tests + 8 parity tests + 14 writer round-trip tests + Web Worker tests + perf test + bundle smoke test = ~248 tests.

## License

MIT. See [LICENSE](./LICENSE).
