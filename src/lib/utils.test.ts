import { describe, expect, it } from 'vitest';
import { validateAmount, validateQuantity } from './utils';

describe('validateAmount', () => {
  it('accepts valid positive numbers', () => {
    expect(validateAmount('100')).toBe(100);
    expect(validateAmount('100.5')).toBe(100.5);
    expect(validateAmount('0')).toBe(0);
  });

  it('rejects empty strings (Number("") would silently become 0)', () => {
    expect(validateAmount('')).toBeNull();
    expect(validateAmount('   ')).toBeNull();
  });

  it('rejects null and undefined', () => {
    expect(validateAmount(null)).toBeNull();
    expect(validateAmount(undefined)).toBeNull();
  });

  it('rejects negative values', () => {
    expect(validateAmount('-10')).toBeNull();
  });

  it('rejects non-numeric and infinite values', () => {
    expect(validateAmount('abc')).toBeNull();
    expect(validateAmount('Infinity')).toBeNull();
    expect(validateAmount('NaN')).toBeNull();
  });
});

describe('validateQuantity', () => {
  it('accepts positive integers', () => {
    expect(validateQuantity('1')).toBe(1);
    expect(validateQuantity('5')).toBe(5);
  });

  it('rejects zero and empty input', () => {
    expect(validateQuantity('0')).toBeNull();
    expect(validateQuantity('')).toBeNull();
  });

  it('rejects negative and non-numeric input', () => {
    expect(validateQuantity('-3')).toBeNull();
    expect(validateQuantity('abc')).toBeNull();
  });
});