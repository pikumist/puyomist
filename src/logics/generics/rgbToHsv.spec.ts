import { describe, expect, it } from 'vitest';
import { rgbToHsv } from './rgbToHsv';

describe('wrapNum()', () => {
  it.each([
    {
      rgb: [0, 0, 0],
      expected: { h: 0, s: 0, v: 0 }
    },
    {
      rgb: [255, 0, 0],
      expected: { h: 0, s: 100, v: 100 }
    },
    {
      rgb: [255, 255, 0],
      expected: { h: 60, s: 100, v: 100 }
    },
    {
      rgb: [0, 255, 0],
      expected: { h: 120, s: 100, v: 100 }
    },
    {
      rgb: [0, 255, 255],
      expected: { h: 180, s: 100, v: 100 }
    },
    {
      rgb: [0, 0, 255],
      expected: { h: 240, s: 100, v: 100 }
    },
    {
      rgb: [255, 0, 255],
      expected: { h: 300, s: 100, v: 100 }
    },
    {
      rgb: [128, 128, 0],
      expected: { h: 60, s: 100, v: 50 }
    },
    {
      rgb: [128, 64, 0],
      expected: { h: 30, s: 100, v: 50 }
    }
  ])('should convert RGB to HSV', ({ rgb, expected }) => {
    // Act
    const actual = rgbToHsv(...(rgb as [number, number, number]));

    // Assert
    expect(actual).toEqual(expected);
  });
});
