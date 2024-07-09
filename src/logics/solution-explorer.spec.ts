import { describe, expect, it } from 'vitest';
import { createNextPuyosAsSameType } from '../reducers/internal/createNextPuyos';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import type { Chain } from './Chain';
import { OptimizationTarget } from './OptimizationTarget';
import { type ColoredPuyoAttribute, PuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { Simulator } from './Simulator';
import { getSpecialBoard } from './boards';
import { solveAllTraces, solveIncludingTraceIndex } from './solution-explorer';

describe('solution-explorer', () => {
  const calcCsp = (chain: Chain, attr: PuyoAttribute) => {
    const c = chain.chainNum;
    const s = chain.attributes[attr]?.separatedBlocksNum;
    const p = chain.poppedPuyoNum;
    if (s) {
      return `${c}-${s}-${p}`;
    }
  };

  const findMostDamageChain = (
    chains: Chain[],
    attr: PuyoAttribute
  ): Chain | undefined => {
    const effectiveChainDamages = chains.filter((chainDamage) => {
      return chainDamage.attributes[attr]?.strength;
    });
    const mostDamageChain = effectiveChainDamages.reduce(
      (m, chainDamage) => {
        if (!m) {
          return chainDamage;
        }
        return chainDamage.attributes[attr]?.strength! >=
          m.attributes[attr]?.strength!
          ? chainDamage
          : m;
      },
      undefined as Chain | undefined
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
        const board = getSpecialBoard(boardId);
        const nextPuyos = createNextPuyosAsSameType(nextPuyoType);
        const simulationData = createSimulationData(board, {
          maxTraceNum,
          poppingLeverage,
          nextPuyos
        });
        const simulator = new Simulator(simulationData);

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
          findMostDamageChain(actual.optimalSolution?.chains!, attr)!,
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
        const board = getSpecialBoard(boardId);
        const nextPuyos = createNextPuyosAsSameType(nextPuyoType);
        const simulationData = createSimulationData(board, {
          maxTraceNum,
          poppingLeverage,
          nextPuyos
        });
        const simulator = new Simulator(simulationData);

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
          findMostDamageChain(actual.optimalSolution?.chains!, attr)!,
          attr
        );
        expect(csp).toBe(expected.csp);
      }
    );
  });
});
