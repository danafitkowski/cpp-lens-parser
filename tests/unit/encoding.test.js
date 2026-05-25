import { describe, it, expect } from 'vitest';
import { detectBomEncoding } from '../../src/encoding.js';

function bytes(...nums) { return new Uint8Array(nums); }

describe('detectBomEncoding', () => {
  it('detects UTF-8 BOM (EF BB BF)', () => {
    expect(detectBomEncoding(bytes(0xef, 0xbb, 0xbf, 0x45))).toBe('utf-8-sig');
  });
  it('detects UTF-32 LE BOM (FF FE 00 00)', () => {
    expect(detectBomEncoding(bytes(0xff, 0xfe, 0x00, 0x00))).toBe('utf-32-le');
  });
  it('detects UTF-32 BE BOM (00 00 FE FF)', () => {
    expect(detectBomEncoding(bytes(0x00, 0x00, 0xfe, 0xff))).toBe('utf-32-be');
  });
  it('detects UTF-16 LE BOM (FF FE, not UTF-32)', () => {
    expect(detectBomEncoding(bytes(0xff, 0xfe, 0x45, 0x00))).toBe('utf-16-le');
  });
  it('detects UTF-16 BE BOM (FE FF)', () => {
    expect(detectBomEncoding(bytes(0xfe, 0xff, 0x00, 0x45))).toBe('utf-16-be');
  });
  it('returns null for no BOM', () => {
    expect(detectBomEncoding(bytes(0x45, 0x52, 0x4d, 0x48))).toBeNull();
  });
  it('returns null for short buffer (<2 bytes)', () => {
    expect(detectBomEncoding(bytes(0xef))).toBeNull();
    expect(detectBomEncoding(bytes())).toBeNull();
  });
  it('returns null for null/undefined input', () => {
    expect(detectBomEncoding(null)).toBeNull();
    expect(detectBomEncoding(undefined)).toBeNull();
  });
  it('handles a UTF-16 LE BOM with only 2 bytes', () => {
    expect(detectBomEncoding(bytes(0xff, 0xfe))).toBe('utf-16-le');
  });
});
