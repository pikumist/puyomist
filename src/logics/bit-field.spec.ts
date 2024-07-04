import { describe, expect, it } from 'vitest';
import {
  allBitsOneInPlace,
  bitFieldAddIndex,
  bitFieldHasIndex,
  bitFieldRemoveIndex,
  createfilledOneBitFieldBeforeIndex
} from './bit-field';

describe('bit-field', () => {
  const allOne = allBitsOneInPlace;

  describe('bitFieldHasIndex()', () => {
    it.each([
      { bitField: [0, 0], index: 0, expected: false },
      { bitField: [0, 0], index: 23, expected: false },
      { bitField: [0, 0], index: 24, expected: false },
      { bitField: [0, 0], index: 47, expected: false },
      { bitField: [1, 0], index: 0, expected: true },
      { bitField: [2, 0], index: 1, expected: true },
      { bitField: [3, 0], index: 0, expected: true },
      { bitField: [3, 0], index: 1, expected: true },
      { bitField: [0, 0], index: 24, expected: false },
      { bitField: [allOne, 0], index: 0, expected: true },
      { bitField: [allOne, 0], index: 23, expected: true },
      { bitField: [allOne, 0], index: 24, expected: false },
      { bitField: [allOne, 1], index: 24, expected: true },
      { bitField: [allOne, 3], index: 24, expected: true },
      { bitField: [allOne, allOne], index: 0, expected: true },
      { bitField: [allOne, allOne], index: 23, expected: true },
      { bitField: [allOne, allOne], index: 24, expected: true },
      { bitField: [allOne, allOne], index: 47, expected: true }
    ])(
      'should return whether bit field has 1 at index',
      ({ bitField, index, expected }) => {
        // Act
        const actual = bitFieldHasIndex(bitField as [number, number], index);

        // Assert
        expect(actual).toBe(expected);
      }
    );
  });

  describe('bitFieldAddIndex()', () => {
    it.each([
      { bitField: [0, 0], index: 0, expected: [1, 0] },
      { bitField: [0, 0], index: 23, expected: [8388608, 0] },
      { bitField: [0, 0], index: 24, expected: [0, 1] },
      { bitField: [0, 0], index: 47, expected: [0, 8388608] },
      { bitField: [1, 0], index: 0, expected: [1, 0] },
      { bitField: [1, 0], index: 23, expected: [8388609, 0] },
      { bitField: [1, 0], index: 24, expected: [1, 1] },
      { bitField: [1, 0], index: 47, expected: [1, 8388608] },
      { bitField: [allOne, allOne], index: 0, expected: [allOne, allOne] },
      { bitField: [allOne, allOne], index: 23, expected: [allOne, allOne] },
      { bitField: [allOne, allOne], index: 24, expected: [allOne, allOne] },
      { bitField: [allOne, allOne], index: 47, expected: [allOne, allOne] }
    ])(
      'should return whether bit field has 1 at index',
      ({ bitField, index, expected }) => {
        // Act
        bitFieldAddIndex(bitField as [number, number], index);

        // Assert
        expect(bitField).toEqual(expected);
      }
    );
  });

  describe('bitFieldRemoveIndex()', () => {
    it.each([
      { bitField: [0, 0], index: 0, expected: [0, 0] },
      { bitField: [0, 0], index: 23, expected: [0, 0] },
      { bitField: [0, 0], index: 24, expected: [0, 0] },
      { bitField: [0, 0], index: 47, expected: [0, 0] },
      { bitField: [1, 0], index: 0, expected: [0, 0] },
      { bitField: [1, 0], index: 23, expected: [1, 0] },
      { bitField: [1, 0], index: 24, expected: [1, 0] },
      { bitField: [1, 0], index: 47, expected: [1, 0] },
      { bitField: [allOne, allOne], index: 0, expected: [allOne - 1, allOne] },
      {
        bitField: [allOne, allOne],
        index: 23,
        expected: [allOne - (1 << 23), allOne]
      },
      { bitField: [allOne, allOne], index: 24, expected: [allOne, allOne - 1] },
      {
        bitField: [allOne, allOne],
        index: 47,
        expected: [allOne, allOne - (1 << 23)]
      }
    ])(
      'should return whether bit field has 1 at index',
      ({ bitField, index, expected }) => {
        // Act
        bitFieldRemoveIndex(bitField as [number, number], index);

        // Assert
        expect(bitField).toEqual(expected);
      }
    );
  });

  describe('createFilledOneBitFieldBeforeIndex()', () => {
    it.each([
      { index: 0, expected: [0, 0] },
      { index: 1, expected: [1, 0] },
      { index: 2, expected: [3, 0] },
      { index: 23, expected: [8388607, 0] },
      { index: 24, expected: [allOne, 0] },
      { index: 25, expected: [allOne, 1] },
      { index: 47, expected: [allOne, 8388607] },
      { index: 48, expected: [allOne, allOne] }
    ])(
      'should create a bit field which is filled one before index',
      ({ index, expected }) => {
        // Act
        const actual = createfilledOneBitFieldBeforeIndex(index);

        // Assert
        expect(actual).toEqual(expected);
      }
    );
  });
});
