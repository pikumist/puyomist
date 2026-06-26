import { describe, expect, it } from 'vitest';
import { type FieldAndNext, cloneFieldAndNext } from './AnimationStep';
import type { Puyo } from './Puyo';
import { PuyoType } from './PuyoType';

const puyo = (id: number, type: PuyoType): Puyo => ({ id, type }) as Puyo;

describe('cloneFieldAndNext', () => {
  it('deep-clones arrays but shares puyo references', () => {
    const data: FieldAndNext = {
      nextPuyos: [puyo(1, PuyoType.Red), undefined],
      field: [
        [puyo(2, PuyoType.Blue)],
        [puyo(3, PuyoType.Green), undefined]
      ]
    };
    const clone = cloneFieldAndNext(data);
    expect(clone).toEqual(data);
    expect(clone.nextPuyos).not.toBe(data.nextPuyos);
    expect(clone.field).not.toBe(data.field);
    expect(clone.field[0]).not.toBe(data.field[0]);
    expect(clone.field[0][0]).toBe(data.field[0][0]);
  });
});
