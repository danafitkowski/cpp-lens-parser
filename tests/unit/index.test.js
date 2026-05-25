import { describe, it, expect } from 'vitest';
import * as lib from '../../src/index.js';

describe('public API surface', () => {
  it('exports parseXer', () => expect(typeof lib.parseXer).toBe('function'));
  it('exports createEmptyModel', () => expect(typeof lib.createEmptyModel).toBe('function'));
  it('exports getTable', () => expect(typeof lib.getTable).toBe('function'));
  it('exports getFields', () => expect(typeof lib.getFields).toBe('function'));
  it('exports parseHeader', () => expect(typeof lib.parseHeader).toBe('function'));
  it('exports detectBomEncoding', () => expect(typeof lib.detectBomEncoding).toBe('function'));

  it('end-to-end: parse minimal XER then read TASK via getTable', () => {
    const xer = [
      'ERMHDR\t24.12\t2024-01-15\tadmin\tdbx\tUSD',
      '%T\tTASK',
      '%F\ttask_id\ttask_name',
      '%R\t1\tFoundation',
      '%R\t2\tFraming',
      '%E'
    ].join('\n');
    const m = lib.parseXer(xer);
    const tasks = lib.getTable(m, 'TASK');
    expect(tasks).toHaveLength(2);
    expect(tasks[1].task_name).toBe('Framing');
    expect(lib.getFields(m, 'TASK')).toEqual(['task_id', 'task_name']);
  });
});
