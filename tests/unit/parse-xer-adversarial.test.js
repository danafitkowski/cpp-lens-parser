import { describe, it, expect } from 'vitest';
import { parseXer } from '../../src/index.js';

// parseXer is a passthrough parser; it must NEVER throw or hang on hostile
// input — only ever return a well-formed { tables, ermhdr, ... } model.
describe('parseXer adversarial input — never throws, never hangs', () => {
  const cases = {
    empty: '',
    whitespace_only: '   \n\t\n  ',
    no_ermhdr: '%T\tTASK\n%F\ttask_id\n%R\t1\n',
    ermhdr_only: 'ERMHDR\t24.12\n',
    R_before_F: 'ERMHDR\t24.12\n%T\tTASK\n%R\t1\tx\n%F\ttask_id\ttask_name\n',
    F_without_T: 'ERMHDR\t24.12\n%F\ta\tb\n%R\t1\t2\n',
    duplicate_tables: 'ERMHDR\t24.12\n%T\tTASK\n%F\ttask_id\n%R\t1\n%T\tTASK\n%F\ttask_id\n%R\t2\n',
    more_cells_than_fields: 'ERMHDR\t24.12\n%T\tTASK\n%F\ta\tb\n%R\t1\t2\t3\t4\t5\n',
    fewer_cells_than_fields: 'ERMHDR\t24.12\n%T\tTASK\n%F\ta\tb\tc\td\n%R\t1\n',
    control_chars: 'ERMHDR\t24.12\n%T\tTASK\n%F\ttask_id\ttask_name\n%R\t1\t\x00\x01\x1b[31m\n',
    null_bytes: 'ERM\x00HDR\t24.12\n%T\tTA\x00SK\n%F\ta\n%R\t1\n',
    unicode: 'ERMHDR\t24.12\n%T\tTASK\n%F\ttask_id\ttask_name\n%R\t1\t日本語\u{1F600}\n',
    only_markers: '%T\n%F\n%R\n%E\n',
    bare_E: '%E',
  };
  for (const [name, txt] of Object.entries(cases)) {
    it(`handles "${name}" → valid model, no throw`, () => {
      let model;
      expect(() => { model = parseXer(txt); }).not.toThrow();
      expect(model).toBeTypeOf('object');
      expect(model.tables).toBeTypeOf('object');
    });
  }

  it('parses a 5 MB single field quickly (no quadratic blowup)', () => {
    const txt = 'ERMHDR\t24.12\n%T\tTASK\n%F\ttask_id\ttask_name\n%R\t1\t' + 'X'.repeat(5_000_000) + '\n';
    const t0 = Date.now();
    const m = parseXer(txt);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(m.tables.TASK.records[0].task_name.length).toBe(5_000_000);
  });
});
