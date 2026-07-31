import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeUnitToBase } from './canonicalize';

describe('normalizeText', () => {
  it('trims, lowercases, and collapses internal whitespace', () => {
    expect(normalizeText('  Maggi   Noodles  ')).toBe('maggi noodles');
  });

  it('lowercases without otherwise altering single-spaced text', () => {
    expect(normalizeText('TOOR DAL 1KG PREM')).toBe('toor dal 1kg prem');
  });
});

describe('normalizeUnitToBase — mixed units (working spec F5)', () => {
  it('kg -> g', () => {
    expect(normalizeUnitToBase('2', 'kg', null, 'g')).toEqual({ qtyBase: 2000, ambiguous: false });
  });

  it('l -> ml', () => {
    expect(normalizeUnitToBase('1.5', 'l', null, 'ml')).toEqual({ qtyBase: 1500, ambiguous: false });
  });

  it('dozen -> piece x12', () => {
    expect(normalizeUnitToBase('2', 'dozen', null, 'piece')).toEqual({ qtyBase: 24, ambiguous: false });
  });

  it('"pack of N" -> piece x N', () => {
    expect(normalizeUnitToBase('1', null, 'pack of 6', 'piece')).toEqual({ qtyBase: 6, ambiguous: false });
  });

  it('"N-pack" -> piece x N', () => {
    expect(normalizeUnitToBase('1', null, '6-pack', 'piece')).toEqual({ qtyBase: 6, ambiguous: false });
  });

  it('"2 x 500ml" -> base-unit N*M', () => {
    expect(normalizeUnitToBase(null, '2 x 500ml', null, 'ml')).toEqual({ qtyBase: 1000, ambiguous: false });
  });

  it('already-base-unit passthrough', () => {
    expect(normalizeUnitToBase('250', 'g', null, 'g')).toEqual({ qtyBase: 250, ambiguous: false });
  });

  it('piece synonym (pcs)', () => {
    expect(normalizeUnitToBase('4', 'pcs', null, 'piece')).toEqual({ qtyBase: 4, ambiguous: false });
  });

  it('no unit display + target piece defaults to qty as-is', () => {
    expect(normalizeUnitToBase('3', null, null, 'piece')).toEqual({ qtyBase: 3, ambiguous: false });
  });

  it('a nonsense unit string lands qtyBase=1, ambiguous=true', () => {
    expect(normalizeUnitToBase('3', 'foobars', null, 'g')).toEqual({ qtyBase: 1, ambiguous: true });
  });
});
