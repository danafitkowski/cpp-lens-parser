# @criticalpathpartners/lens-parser

JavaScript reader and writer for Primavera P6 XER files. Pure ES modules, browser-compatible, zero runtime dependencies.

Companion to [cpp-cpm-engine](https://github.com/danafitkowski/cpp-cpm-engine) and powers the CPP Lens browser viewer at https://criticalpathpartners.ca/viewer/.

## Status

v0.1.0 — initial release. Read + write at parity with the canonical Python xer-parser skill.

## Install

```bash
npm install @criticalpathpartners/lens-parser
```

## Usage

```javascript
import {
  parseXer, writeXer,
  getTable, getFields,
  buildWbsMap, buildPredecessorMap, buildResourceMap, buildActivityCodeMap, buildUdfMap,
  getCalendarMap, addWorkDays, subtractWorkDays, getWorkDaysBetween, durationHoursToDays
} from '@criticalpathpartners/lens-parser';

// Read an XER file
const xerText = await fetch('/schedule.xer').then(r => r.text());
const model = parseXer(xerText, { filename: 'schedule.xer' });

// Access tables
const tasks = getTable(model, 'TASK');
const taskFields = getFields(model, 'TASK');

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

## Test count

207 unit tests + 8 parity tests + 14 writer round-trip tests + Web Worker tests + perf test + bundle smoke test = ~240 tests.

## License

MIT. See [LICENSE](./LICENSE).
