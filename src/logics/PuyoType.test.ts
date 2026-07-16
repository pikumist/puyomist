import { describe, expect, it } from 'vitest';
import { PuyoAttr } from './PuyoAttr';
import {
  PuyoType,
  convertPuyoType,
  getPuyoAttr,
  getPuyoRgb,
  getPuyoTypeName,
  isChancePuyo,
  isColoredPuyoType,
  isPlusPuyo,
  isTraceablePuyo,
  puyoTypeMap,
  toChanceColoredType,
  toNormalColoredType,
  toPlusColoredType
} from './PuyoType';

const allTypes = Object.values(PuyoType).filter(
  (v): v is PuyoType => typeof v === 'number'
);

describe('PuyoType helpers', () => {
  it('getPuyoTypeName returns mapped name or empty string', () => {
    expect(getPuyoTypeName(PuyoType.Red)).toBe('赤');
    expect(getPuyoTypeName(undefined)).toBe('');
    for (const t of allTypes) {
      expect(getPuyoTypeName(t)).toBe(puyoTypeMap.get(t));
    }
  });

  it('isColoredPuyoType is true only for colored puyos', () => {
    expect(isColoredPuyoType(PuyoType.Red)).toBe(true);
    expect(isColoredPuyoType(PuyoType.PurpleChancePlus)).toBe(true);
    expect(isColoredPuyoType(PuyoType.Heart)).toBe(false);
    expect(isColoredPuyoType(PuyoType.Prism)).toBe(false);
    expect(isColoredPuyoType(PuyoType.Question)).toBe(false);
  });

  it('isPlusPuyo detects plus variants', () => {
    expect(isPlusPuyo(PuyoType.RedPlus)).toBe(true);
    expect(isPlusPuyo(PuyoType.PurpleChancePlus)).toBe(true);
    expect(isPlusPuyo(PuyoType.Red)).toBe(false);
    expect(isPlusPuyo(undefined)).toBe(false);
    expect(isPlusPuyo(PuyoType.Heart)).toBe(false);
  });

  it('isChancePuyo detects chance variants', () => {
    expect(isChancePuyo(PuyoType.RedChance)).toBe(true);
    expect(isChancePuyo(PuyoType.PurpleChancePlus)).toBe(true);
    expect(isChancePuyo(PuyoType.Red)).toBe(false);
    expect(isChancePuyo(PuyoType.Heart)).toBe(false);
  });

  it('isTraceablePuyo is false for ojama/kata/question/undefined', () => {
    expect(isTraceablePuyo(undefined)).toBe(false);
    expect(isTraceablePuyo(PuyoType.Ojama)).toBe(false);
    expect(isTraceablePuyo(PuyoType.Kata)).toBe(false);
    expect(isTraceablePuyo(PuyoType.Question)).toBe(false);
    expect(isTraceablePuyo(PuyoType.Red)).toBe(true);
    expect(isTraceablePuyo(PuyoType.Heart)).toBe(true);
    expect(isTraceablePuyo(PuyoType.Prism)).toBe(true);
  });

  it('getPuyoAttr maps every type to an attribute', () => {
    expect(getPuyoAttr(PuyoType.Red)).toBe(PuyoAttr.Red);
    expect(getPuyoAttr(PuyoType.Blue)).toBe(PuyoAttr.Blue);
    expect(getPuyoAttr(PuyoType.Green)).toBe(PuyoAttr.Green);
    expect(getPuyoAttr(PuyoType.Yellow)).toBe(PuyoAttr.Yellow);
    expect(getPuyoAttr(PuyoType.Purple)).toBe(PuyoAttr.Purple);
    expect(getPuyoAttr(PuyoType.Heart)).toBe(PuyoAttr.Heart);
    expect(getPuyoAttr(PuyoType.Prism)).toBe(PuyoAttr.Prism);
    expect(getPuyoAttr(PuyoType.Ojama)).toBe(PuyoAttr.Ojama);
    expect(getPuyoAttr(PuyoType.Kata)).toBe(PuyoAttr.Kata);
    expect(getPuyoAttr(PuyoType.Question)).toBe(PuyoAttr.Question);
    expect(getPuyoAttr(undefined)).toBeUndefined();
    for (const t of allTypes) {
      expect(getPuyoAttr(t)).toBeDefined();
    }
  });

  it('toNormalColoredType strips plus/chance and keeps non-colored intact', () => {
    expect(toNormalColoredType(PuyoType.RedChancePlus)).toBe(PuyoType.Red);
    expect(toNormalColoredType(PuyoType.BluePlus)).toBe(PuyoType.Blue);
    expect(toNormalColoredType(PuyoType.GreenChance)).toBe(PuyoType.Green);
    expect(toNormalColoredType(PuyoType.YellowPlus)).toBe(PuyoType.Yellow);
    expect(toNormalColoredType(PuyoType.PurpleChance)).toBe(PuyoType.Purple);
    expect(toNormalColoredType(PuyoType.Heart)).toBe(PuyoType.Heart);
  });

  it('toChanceColoredType adds chance and preserves plus', () => {
    expect(toChanceColoredType(PuyoType.Red)).toBe(PuyoType.RedChance);
    expect(toChanceColoredType(PuyoType.RedPlus)).toBe(PuyoType.RedChancePlus);
    expect(toChanceColoredType(PuyoType.Blue)).toBe(PuyoType.BlueChance);
    expect(toChanceColoredType(PuyoType.BluePlus)).toBe(
      PuyoType.BlueChancePlus
    );
    expect(toChanceColoredType(PuyoType.Green)).toBe(PuyoType.GreenChance);
    expect(toChanceColoredType(PuyoType.GreenPlus)).toBe(
      PuyoType.GreenChancePlus
    );
    expect(toChanceColoredType(PuyoType.Yellow)).toBe(PuyoType.YellowChance);
    expect(toChanceColoredType(PuyoType.YellowPlus)).toBe(
      PuyoType.YellowChancePlus
    );
    expect(toChanceColoredType(PuyoType.Purple)).toBe(PuyoType.PurpleChance);
    expect(toChanceColoredType(PuyoType.PurplePlus)).toBe(
      PuyoType.PurpleChancePlus
    );
    expect(toChanceColoredType(PuyoType.Heart)).toBe(PuyoType.Heart);
  });

  it('toPlusColoredType adds plus and preserves chance', () => {
    expect(toPlusColoredType(PuyoType.Red)).toBe(PuyoType.RedPlus);
    expect(toPlusColoredType(PuyoType.RedChance)).toBe(PuyoType.RedChancePlus);
    expect(toPlusColoredType(PuyoType.Blue)).toBe(PuyoType.BluePlus);
    expect(toPlusColoredType(PuyoType.BlueChance)).toBe(
      PuyoType.BlueChancePlus
    );
    expect(toPlusColoredType(PuyoType.Green)).toBe(PuyoType.GreenPlus);
    expect(toPlusColoredType(PuyoType.GreenChance)).toBe(
      PuyoType.GreenChancePlus
    );
    expect(toPlusColoredType(PuyoType.Yellow)).toBe(PuyoType.YellowPlus);
    expect(toPlusColoredType(PuyoType.YellowChance)).toBe(
      PuyoType.YellowChancePlus
    );
    expect(toPlusColoredType(PuyoType.Purple)).toBe(PuyoType.PurplePlus);
    expect(toPlusColoredType(PuyoType.PurpleChance)).toBe(
      PuyoType.PurpleChancePlus
    );
    expect(toPlusColoredType(PuyoType.Heart)).toBe(PuyoType.Heart);
  });

  it('convertPuyoType keeps question and converts colored/non-colored', () => {
    expect(convertPuyoType(PuyoType.Question, PuyoAttr.Red)).toBe(
      PuyoType.Question
    );
    // colored -> colored preserves plus/chance terms
    expect(convertPuyoType(PuyoType.RedChancePlus, PuyoAttr.Blue)).toBe(
      PuyoType.BlueChancePlus
    );
    expect(convertPuyoType(PuyoType.Red, PuyoAttr.Green)).toBe(PuyoType.Green);
    expect(convertPuyoType(PuyoType.RedPlus, PuyoAttr.Yellow)).toBe(
      PuyoType.YellowPlus
    );
    expect(convertPuyoType(PuyoType.Red, PuyoAttr.Purple)).toBe(
      PuyoType.Purple
    );
    // colored -> non-colored
    expect(convertPuyoType(PuyoType.Red, PuyoAttr.Heart)).toBe(PuyoType.Heart);
    expect(convertPuyoType(PuyoType.Red, PuyoAttr.Prism)).toBe(PuyoType.Prism);
    expect(convertPuyoType(PuyoType.Red, PuyoAttr.Ojama)).toBe(PuyoType.Ojama);
    expect(convertPuyoType(PuyoType.Red, PuyoAttr.Kata)).toBe(PuyoType.Kata);
    // non-colored -> any
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Red)).toBe(PuyoType.Red);
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Blue)).toBe(PuyoType.Blue);
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Green)).toBe(
      PuyoType.Green
    );
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Yellow)).toBe(
      PuyoType.Yellow
    );
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Purple)).toBe(
      PuyoType.Purple
    );
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Prism)).toBe(
      PuyoType.Prism
    );
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Ojama)).toBe(
      PuyoType.Ojama
    );
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Kata)).toBe(PuyoType.Kata);
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Question)).toBe(
      PuyoType.Question
    );
    expect(convertPuyoType(PuyoType.Ojama, PuyoAttr.Red)).toBe(PuyoType.Red);
    // non-colored -> heart hits the final switch's Heart case directly
    expect(convertPuyoType(PuyoType.Heart, PuyoAttr.Heart)).toBe(
      PuyoType.Heart
    );
  });

  it('getPuyoRgb returns a color for every attribute', () => {
    for (const t of allTypes) {
      expect(typeof getPuyoRgb(t)).toBe('string');
    }
    expect(getPuyoRgb(PuyoType.Red)).toBe('#c00');
    expect(getPuyoRgb(PuyoType.Prism)).toBe('#fff');
  });

  it('getPuyoRgb throws for an unknown puyo type', () => {
    expect(() => getPuyoRgb(0 as PuyoType)).toThrow(
      'The attr of puyo is unknown.'
    );
  });
});
