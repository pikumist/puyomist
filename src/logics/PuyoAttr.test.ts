import { describe, expect, it } from 'vitest';
import { PuyoAttr, getPuyoAttrName, isColoredPuyoAttr } from './PuyoAttr';

describe('PuyoAttr helpers', () => {
  it('getPuyoAttrName returns the mapped name for a known attribute', () => {
    expect(getPuyoAttrName(PuyoAttr.Red)).toBe('赤');
    expect(getPuyoAttrName(PuyoAttr.Heart)).toBe('ハート');
  });

  it('getPuyoAttrName returns an empty string when unmapped or undefined', () => {
    expect(getPuyoAttrName(PuyoAttr.Padding)).toBe('');
    expect(getPuyoAttrName(undefined)).toBe('');
  });

  it('isColoredPuyoAttr identifies only the five color attributes', () => {
    expect(isColoredPuyoAttr(PuyoAttr.Red)).toBe(true);
    expect(isColoredPuyoAttr(PuyoAttr.Purple)).toBe(true);
    expect(isColoredPuyoAttr(PuyoAttr.Heart)).toBe(false);
  });
});
