import { describe, expect, it } from 'vitest';
import { wrapNum } from './wrapNum';

describe('wrapNum()', () => {
  it.each([
    { x: -1, range: [0, 360], expected: 359 },
    { x: 0, range: [0, 360], expected: 0 },
    { x: 0.1, range: [0, 360], expected: 0.1 },
    { x: 180, range: [0, 360], expected: 180 },
    { x: 360, range: [0, 360], expected: 0 },
    { x: 361, range: [0, 360], expected: 1 }
  ])(
    'should be range[0] <= result < range[1] if includeMax is falsy',
    ({ x, range, expected }) => {
      // Act
      const actual1 = wrapNum(x, range as [number, number]);
      const actual2 = wrapNum(x, range as [number, number], false);

      // Assert
      expect(actual1).toBeCloseTo(expected);
      expect(actual2).toBe(actual1);
    }
  );

  it.each([
    { x: -1, range: [0, 360], expected: 359 },
    { x: 0, range: [0, 360], expected: 0 },
    { x: 0.1, range: [0, 360], expected: 0.1 },
    { x: 180, range: [0, 360], expected: 180 },
    { x: 360, range: [0, 360], expected: 360 },
    { x: 361, range: [0, 360], expected: 1 },
    { x: 720, range: [0, 360], expected: 0 }
  ])(
    'should be range[0] <= result <= range[1] if includeMax is true',
    ({ x, range, expected }) => {
      // Act
      const actual = wrapNum(x, range as [number, number], true);

      // Assert
      expect(actual).toBeCloseTo(expected);
    }
  );
});
