import { describe, expect, it } from 'vitest';
import { calcChainFactor, calcDamageTerm, calcPoppingFactor } from './damage';

describe('damage', () => {
  describe('calcDamageTerm()', () => {
    it.each([
      {
        cardAttackStrength: 2,
        poppingFactor: 3,
        chainFactor: 4,
        expected: 24
      },
      {
        cardAttackStrength: 3,
        poppingFactor: 4,
        chainFactor: 5,
        expected: 60
      }
    ])(
      'should return the product of cardAttackStrength, poppingFactor, and chainFactor',
      ({ cardAttackStrength, poppingFactor, chainFactor, expected }) => {
        // Act
        const actual = calcDamageTerm(
          cardAttackStrength,
          poppingFactor,
          chainFactor
        );

        // Assert
        expect(actual).toBe(expected);
      }
    );
  });

  describe('calcPoppingFactor()', () => {
    it.each([
      {
        poppedPuyoNum: 4,
        separatedBlocksNum: 1,
        expected: 1
      },
      {
        poppedPuyoNum: 5,
        separatedBlocksNum: 1,
        expected: 1.15
      },
      {
        poppedPuyoNum: 5,
        separatedBlocksNum: 1,
        options: {
          poppingLeverage: 5.0
        },
        expected: 1.75
      },
      {
        poppedPuyoNum: 5,
        separatedBlocksNum: 1,
        options: {
          minimumPuyoNumForPopping: 3,
          poppingLeverage: 5.0
        },
        expected: 2.5
      },
      {
        poppedPuyoNum: 5,
        separatedBlocksNum: 1,
        options: {
          minimumPuyoNumForPopping: 3,
          poppingCoefficient: 0.3,
          poppingLeverage: 5.0
        },
        expected: 4
      },
      {
        poppedPuyoNum: 8,
        separatedBlocksNum: 2,
        options: {
          minimumPuyoNumForPopping: 4,
          poppingCoefficient: 0.15,
          poppingLeverage: 1.0
        },
        expected: 3.2
      },
      {
        poppedPuyoNum: 4,
        separatedBlocksNum: 1,
        options: {
          minimumPuyoNumForPopping: 3,
          poppingCoefficient: 0.15,
          poppingLeverage: 5.0
        },
        expected: 1.75
      }
    ])(
      'should return the calculated popping factor',
      ({ poppedPuyoNum, separatedBlocksNum, options, expected }) => {
        // Act
        const actual = calcPoppingFactor(
          poppedPuyoNum,
          separatedBlocksNum,
          options
        );

        // Assert
        expect(actual).toBeCloseTo(expected);
      }
    );
  });

  describe('calcChainFactor()', () => {
    it.each([
      {
        chainNum: 1,
        chainLeverage: 1,
        expected: 1
      },
      {
        chainNum: 1,
        chainLeverage: undefined,
        expected: 1
      },
      {
        chainNum: 2,
        chainLeverage: 1,
        expected: 1.4
      },
      {
        chainNum: 3,
        chainLeverage: 1,
        expected: 1.7
      },
      {
        chainNum: 4,
        chainLeverage: 1,
        expected: 2
      },
      {
        chainNum: 5,
        chainLeverage: 1,
        expected: 2.2
      },
      {
        chainNum: 10,
        chainLeverage: 1,
        expected: 3.2
      },
      {
        chainNum: 18,
        chainLeverage: 1,
        expected: 4.8
      },
      {
        chainNum: 1,
        chainLeverage: 7,
        expected: 1
      },
      {
        chainNum: 2,
        chainLeverage: 7,
        expected: 3.8
      },
      {
        chainNum: 3,
        chainLeverage: 7,
        expected: 5.9
      },
      {
        chainNum: 4,
        chainLeverage: 7,
        expected: 8
      },
      {
        chainNum: 5,
        chainLeverage: 7,
        expected: 9.4
      },
      {
        chainNum: 10,
        chainLeverage: 7,
        expected: 16.4
      },
      {
        chainNum: 18,
        chainLeverage: 7,
        expected: 27.6
      }
    ])(
      'should return the calculated chain factor',
      ({ chainNum, chainLeverage, expected }) => {
        // Act
        const actual = calcChainFactor(chainNum, chainLeverage);

        // Assert
        expect(actual).toBeCloseTo(expected);
      }
    );

    it.each([1.1, 2.3])(
      'should throw an error if chainNum is not an integer',
      (chainNum) => {
        // Act
        () => calcChainFactor(chainNum);

        // Assert
        expect(() => calcChainFactor(1.1)).toThrow(
          'chainNum must be an integer.'
        );
      }
    );

    it.each([0, -1])(
      'should throw an error if chainNum is less than 1',
      (chainNum) => {
        // Act
        () => calcChainFactor(chainNum);

        // Assert
        expect(() => calcChainFactor(chainNum)).toThrow(
          'chainNum must be 1 or greater.'
        );
      }
    );
  });
});
