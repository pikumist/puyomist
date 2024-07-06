import { describe, expect, it } from 'vitest';
import { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';
import { Simulator } from './Simulator';
import { getSpecialBoard } from './boards';
import type { ChainDamage } from './damage';
import { type ColoredPuyoAttribute, PuyoAttribute, PuyoType } from './puyo';
import { solveAllTraces, solveIncludingTraceIndex } from './solution-explorer';

describe('solution-explorer', () => {
  const calcCsp = (chainDamage: ChainDamage, attr: PuyoAttribute) => {
    const c = chainDamage.chainNum;
    const s = chainDamage.damageTerms[attr]?.separatedBlocksNum;
    const p = chainDamage.poppedPuyoNum;
    if (s) {
      return `${c}-${s}-${p}`;
    }
  };

  const findMostDamageChain = (
    chainDamages: ChainDamage[],
    attr: PuyoAttribute
  ): ChainDamage | undefined => {
    const effectiveChainDamages = chainDamages.filter((chainDamage) => {
      return chainDamage.damageTerms[attr]?.strength;
    });
    const mostDamageChain = effectiveChainDamages.reduce(
      (m, chainDamage) => {
        if (!m) {
          return chainDamage;
        }
        return chainDamage.damageTerms[attr]?.strength! >=
          m.damageTerms[attr]?.strength!
          ? chainDamage
          : m;
      },
      undefined as ChainDamage | undefined
    );

    return mostDamageChain;
  };

  describe('solveAllTraces()', () => {
    it.each([
      {
        attr: PuyoAttribute.Green,
        optimizationTarget: OptimizationTarget.GreenDamage,
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule1/1',
        nextPuyoType: PuyoType.Green,
        expected: {
          candidatesNum: 15359,
          traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
          totalAttrDamage: 109.0,
          csp: '14-2-10'
        }
      },
      {
        attr: PuyoAttribute.Blue,
        optimizationTarget: OptimizationTarget.BlueDamage,
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule2/1',
        nextPuyoType: PuyoType.Blue,
        expected: {
          candidatesNum: 15359,
          traceCoords: [
            PuyoCoord.xyToCoord(3, 0),
            PuyoCoord.xyToCoord(4, 1),
            PuyoCoord.xyToCoord(5, 0),
            PuyoCoord.xyToCoord(4, 2),
            PuyoCoord.xyToCoord(3, 3)
          ],
          totalAttrDamage: 109.4,
          csp: '10-2-13'
        }
      }
    ])(
      'should find an optimal solution for the optimization target',
      ({
        attr,
        optimizationTarget,
        maxTraceNum,
        poppingLeverage,
        boardId,
        nextPuyoType,
        expected
      }) => {
        // Arrange
        const simulator = new Simulator();
        const board = getSpecialBoard(boardId);
        simulator.resetWithBoard(board);
        simulator.setMaxTraceNum(maxTraceNum);
        simulator.setPoppingLeverage(poppingLeverage);
        simulator.resetNextPuyosAsSameType(nextPuyoType);

        // Act
        const actual = solveAllTraces(simulator, optimizationTarget)!;

        // Assert
        expect(actual.optimizationTarget).toBe(optimizationTarget);
        expect(actual.candidatesNum).toBe(expected.candidatesNum);
        expect(actual.optimalSolution?.traceCoords).toEqual(
          expected.traceCoords
        );
        expect(
          actual.optimalSolution?.totalDamages[attr as ColoredPuyoAttribute]
        ).toBeCloseTo(expected.totalAttrDamage);
        const csp = calcCsp(
          findMostDamageChain(actual.optimalSolution?.chainDamages!, attr)!,
          attr
        );
        expect(csp).toBe(expected.csp);
      }
    );
  });

  describe('solveIncludingTraceIndex()', () => {
    it.each([
      {
        traceIndex: 21,
        attr: PuyoAttribute.Green,
        optimizationTarget: OptimizationTarget.GreenDamage,
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule1/1',
        nextPuyoType: PuyoType.Green,
        expected: {
          candidatesNum: 539,
          traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
          totalAttrDamage: 109.0,
          csp: '14-2-10'
        }
      },
      {
        traceIndex: 3,
        attr: PuyoAttribute.Blue,
        optimizationTarget: OptimizationTarget.BlueDamage,
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule2/1',
        nextPuyoType: PuyoType.Blue,
        expected: {
          candidatesNum: 760,
          traceCoords: [
            PuyoCoord.xyToCoord(3, 0),
            PuyoCoord.xyToCoord(4, 1),
            PuyoCoord.xyToCoord(5, 0),
            PuyoCoord.xyToCoord(4, 2),
            PuyoCoord.xyToCoord(3, 3)
          ],
          totalAttrDamage: 109.4,
          csp: '10-2-13'
        }
      }
    ])(
      'should find an optimal solution that includes the trace index',
      ({
        traceIndex,
        attr,
        optimizationTarget,
        maxTraceNum,
        poppingLeverage,
        boardId,
        nextPuyoType,
        expected
      }) => {
        // Arrange
        const simulator = new Simulator();
        const board = getSpecialBoard(boardId);
        simulator.resetWithBoard(board);
        simulator.setMaxTraceNum(maxTraceNum);
        simulator.setPoppingLeverage(poppingLeverage);
        simulator.resetNextPuyosAsSameType(nextPuyoType);

        // Act
        const actual = solveIncludingTraceIndex(
          simulator,
          optimizationTarget,
          traceIndex
        )!;

        // Assert
        expect(actual.optimizationTarget).toBe(optimizationTarget);
        expect(actual.candidatesNum).toBe(expected.candidatesNum);
        expect(actual.optimalSolution?.traceCoords).toEqual(
          expected.traceCoords
        );
        expect(
          actual.optimalSolution?.totalDamages[attr as ColoredPuyoAttribute]
        ).toBeCloseTo(expected.totalAttrDamage);
        const csp = calcCsp(
          findMostDamageChain(actual.optimalSolution?.chainDamages!, attr)!,
          attr
        );
        expect(csp).toBe(expected.csp);
      }
    );
  });
});
