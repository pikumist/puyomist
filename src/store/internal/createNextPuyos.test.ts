import { describe, expect, it } from 'vitest';
import { PuyoCoord } from '../../logics/PuyoCoord';
import { getPuyoAttr, PuyoType } from '../../logics/PuyoType';
import { PuyoAttr } from '../../logics/PuyoAttr';
import {
  createNextPuyos,
  createNextPuyosAsRandom,
  createNextPuyosAsSameType
} from './createNextPuyos';

describe('createNextPuyos', () => {
  it('returns an empty row when nextSelection is missing', () => {
    const result = createNextPuyos();
    expect(result).toHaveLength(PuyoCoord.XNum);
    expect(result.every((p) => p === undefined)).toBe(true);
  });

  it('returns empty row for unknown selection', () => {
    const result = createNextPuyos('bogus');
    expect(result.every((p) => p === undefined)).toBe(true);
  });

  it('creates random colored puyos', () => {
    const result = createNextPuyosAsRandom();
    expect(result).toHaveLength(PuyoCoord.XNum);
    expect(result.every((p) => p !== undefined)).toBe(true);
  });

  it.each([
    ['red', PuyoAttr.Red],
    ['blue', PuyoAttr.Blue],
    ['green', PuyoAttr.Green],
    ['yellow', PuyoAttr.Yellow],
    ['purple', PuyoAttr.Purple]
  ] as const)('creates a single-colour row for %s', (sel, attr) => {
    const result = createNextPuyos(sel);
    expect(result.every((p) => getPuyoAttr(p?.type) === attr)).toBe(true);
  });

  it.each([
    ['red+', PuyoType.RedPlus],
    ['blue+', PuyoType.BluePlus],
    ['green+', PuyoType.GreenPlus],
    ['yellow+', PuyoType.YellowPlus],
    ['purple+', PuyoType.PurplePlus]
  ] as const)('honours the + suffix for plus puyos (%s)', (sel, expected) => {
    const result = createNextPuyos(sel);
    expect(result.every((p) => p?.type === expected)).toBe(true);
  });

  it('createNextPuyosAsSameType fills the row', () => {
    const result = createNextPuyosAsSameType(PuyoType.Heart);
    expect(result.every((p) => p?.type === PuyoType.Heart)).toBe(true);
  });

  it('random selection produces only colored puyos', () => {
    const result = createNextPuyos('random');
    expect(
      result.every((p) => p !== undefined && getPuyoAttr(p.type) !== undefined)
    ).toBe(true);
  });
});
