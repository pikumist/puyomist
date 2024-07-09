import { describe, expect, it } from 'vitest';
import {
  differenceSet,
  intersectionSet,
  isSubset,
  isSuperset,
  symmetricDifferenceSet,
  unionSet
} from './set';

describe('set', () => {
  describe('isSuperset()', () => {
    it.each([
      {
        former: new Set(['A', 'B']),
        latter: new Set(['A', 'B', 'C']),
        expected: false
      },
      {
        former: new Set(['A', 'B', 'C']),
        latter: new Set(['A', 'B']),
        expected: true
      }
    ])(
      'should return true if the former set contains the latter set',
      ({ former, latter, expected }) => {
        // Actual
        const actual = isSuperset(former, latter);

        // Assert
        expect(actual).toBe(expected);
      }
    );
  });

  describe('isSubset()', () => {
    it.each([
      {
        former: new Set(['A', 'B']),
        latter: new Set(['A', 'B', 'C']),
        expected: true
      },
      {
        former: new Set(['A', 'B', 'C']),
        latter: new Set(['A', 'B']),
        expected: false
      }
    ])(
      'should return true if the latter set contains the former set',
      ({ former, latter, expected }) => {
        // Actual
        const actual = isSubset(former, latter);

        // Assert
        expect(actual).toBe(expected);
      }
    );
  });

  describe('unionSet()', () => {
    it.each([
      {
        former: new Set(['A', 'B']),
        latter: new Set(['B', 'C']),
        expected: new Set(['A', 'B', 'C'])
      }
    ])(
      'should return the union set of the former and the latter',
      ({ former, latter, expected }) => {
        // Actual
        const actual = unionSet(former, latter);

        // Assert
        expect(actual).toEqual(expected);
      }
    );
  });

  describe('intersectionSet()', () => {
    it.each([
      {
        former: new Set(['A', 'B']),
        latter: new Set(['B', 'C']),
        expected: new Set(['B'])
      }
    ])(
      'should return the intersection set of the former and the latter',
      ({ former, latter, expected }) => {
        // Actual
        const actual = intersectionSet(former, latter);

        // Assert
        expect(actual).toEqual(expected);
      }
    );
  });

  describe('symmetricDifferenceSet()', () => {
    it.each([
      {
        former: new Set(['A', 'B']),
        latter: new Set(['B', 'C']),
        expected: new Set(['A', 'C'])
      }
    ])(
      'should return the symmetric difference set of the former and the latter',
      ({ former, latter, expected }) => {
        // Actual
        const actual = symmetricDifferenceSet(former, latter);

        // Assert
        expect(actual).toEqual(expected);
      }
    );
  });

  describe('differenceSet()', () => {
    it.each([
      {
        former: new Set(['A', 'B']),
        latter: new Set(['B', 'C']),
        expected: new Set(['A'])
      }
    ])(
      'should return the difference set of the former and the latter',
      ({ former, latter, expected }) => {
        // Actual
        const actual = differenceSet(former, latter);

        // Assert
        expect(actual).toEqual(expected);
      }
    );
  });
});
