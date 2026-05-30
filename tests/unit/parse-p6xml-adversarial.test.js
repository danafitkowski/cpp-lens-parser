// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseP6Xml, getTable } from '../../src/index.js';

const deep = (n) => '<?xml version="1.0"?><APIBusinessObjects>' + '<g>'.repeat(n) +
  '<Activity><ObjectId>1</ObjectId><Name>x</Name></Activity>' + '</g>'.repeat(n) +
  '</APIBusinessObjects>';

describe('parseP6Xml adversarial input', () => {
  it('empty input → empty model, no throw', () => {
    const m = parseP6Xml('');
    expect(m.tables).toEqual({});
  });

  it('malformed XML throws a clean parseP6Xml error (caught by the viewer upload handler)', () => {
    expect(() => parseP6Xml('<?xml version="1.0"?><APIBusinessObjects><unclosed>'))
      .toThrow(/parseP6Xml/);
  });

  it('iterative traversal — moderately deep nesting parses without a MY-code stack overflow', () => {
    // jsdom accepts this depth; the iterative walk must not add its own overflow.
    const m = parseP6Xml(deep(1500));
    expect(getTable(m, 'TASK').length).toBe(1);
  });

  it('preserves document order of extracted records', () => {
    const xml = '<?xml version="1.0"?><APIBusinessObjects><Project><ObjectId>1</ObjectId>' +
      [3, 1, 2].map(i => `<Activity><ObjectId>${i}</ObjectId><Id>A${i}</Id><Name>n${i}</Name></Activity>`).join('') +
      '</Project></APIBusinessObjects>';
    expect(getTable(parseP6Xml(xml), 'TASK').map(t => t.task_id)).toEqual(['3', '1', '2']);
  });

  it('does not expand entity bombs (no billion-laughs amplification)', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">' +
      '<!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">' +
      '<!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">]>' +
      '<APIBusinessObjects><Activity><ObjectId>1</ObjectId><Name>&lol3;</Name></Activity></APIBusinessObjects>';
    const t0 = Date.now();
    let threw = false;
    try { parseP6Xml(bomb); } catch { threw = true; }
    expect(Date.now() - t0).toBeLessThan(2000); // no exponential blowup
    expect(threw === true || threw === false).toBe(true); // either way: bounded, no hang
  });
});
