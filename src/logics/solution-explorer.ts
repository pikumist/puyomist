/**
 * @module なぞりの最適解探索
 */

import { OptimizationTarget } from './OptimizationTarget';
import { type ColoredPuyoAttribute, PuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import { isTraceablePuyo } from './PuyoType';
import { Simulator } from './Simulator';
import { createfilledOneBitFieldBeforeIndex } from './bit-field';
import {
  type ExplorationResult,
  type SolutionCarry,
  type SolutionResult,
  SolutionState,
  type TotalDamages
} from './solution';

/**
 * シミュレーターの最大なぞり消し数を超えない範囲で全てのなぞりを試して最適解を求める。
 * @param simulator シミュレーター
 * @param optimizationTarget 最適化対象
 * @returns
 */
export const solveAllTraces = (
  simulator: Simulator,
  optimizationTarget: OptimizationTarget
): ExplorationResult | undefined => {
  const startTime = Date.now();

  const carry: SolutionCarry = {
    solutionNums: 0,
    optimalSolution: undefined
  };

  for (let y = 0; y < PuyoCoord.YNum; y++) {
    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const coord = PuyoCoord.xyToCoord(x, y)!;
      const state = new SolutionState(
        createfilledOneBitFieldBeforeIndex(coord.index),
        new Map()
      );
      advanceTrace(simulator, optimizationTarget, state, carry, coord);
    }
  }

  const endTime = Date.now();
  const elapsedTime = endTime - startTime;

  return {
    optimizationTarget,
    elapsedTime,
    candidatesNum: carry.solutionNums,
    optimalSolution: carry.optimalSolution
  };
};

/**
 * なぞり開始位置を固定して最適解を求める。
 * @param simulator シミュレーター
 * @param optimizationTarget 最適化の対象
 * @param index なぞり開始位置のインデックス (0-47)。これより若いインデックスを含むなぞりは探索されない。
 * @returns
 */
export const solveIncludingTraceIndex = (
  simulator: Simulator,
  optimizationTarget: OptimizationTarget,
  index: number
): ExplorationResult | undefined => {
  const startTime = Date.now();

  const carry: SolutionCarry = {
    solutionNums: 0,
    optimalSolution: undefined
  };

  advanceTrace(
    new Simulator(simulator.getSimulationData()),
    optimizationTarget,
    new SolutionState(createfilledOneBitFieldBeforeIndex(index), new Map()),
    carry,
    PuyoCoord.indexToCoord(index)!
  );

  const endTime = Date.now();
  const elapsedTime = endTime - startTime;

  return {
    optimizationTarget,
    elapsedTime,
    candidatesNum: carry.solutionNums,
    optimalSolution: carry.optimalSolution
  };
};

const advanceTrace = (
  simulator: Simulator,
  optTarget: OptimizationTarget,
  state: SolutionState,
  carry: SolutionCarry,
  coord: PuyoCoord
): void => {
  if (!isTraceablePuyo(simulator.getField()[coord.y][coord.x]?.type)) {
    return;
  }
  if (!state.checkIfAddableCoord(coord, simulator.getActualMaxTraceNum())) {
    return;
  }

  const s = SolutionState.clone(state);
  s.addTraceCoord(coord);

  updateCarry(
    carry,
    optTarget,
    calcSolutionResult(simulator, s.getTraceCoords())
  );

  for (const nextCoord of s.enumerateCandidates()) {
    advanceTrace(simulator, optTarget, s, carry, nextCoord)!;
  }
};

const updateCarry = (
  carry: SolutionCarry,
  optTarget: OptimizationTarget,
  solutionResult: SolutionResult
): void => {
  carry.solutionNums++;

  if (!carry.optimalSolution) {
    carry.optimalSolution = solutionResult;
    return;
  }

  carry.optimalSolution = betterSolution(
    optTarget,
    carry.optimalSolution,
    solutionResult
  );
};

/**
 * s1 と s2 とで良い解法の方を返す。優劣付けれらない場合は s1 を返す。
 * @param s1
 * @param s2
 * @returns
 */
export const betterSolution = (
  optTarget: OptimizationTarget,
  s1: SolutionResult,
  s2: SolutionResult
): SolutionResult => {
  switch (optTarget) {
    case OptimizationTarget.TotalDamage: {
      if (
        s2.totalDamages.total > s1.totalDamages.total ||
        (s2.totalDamages.total === s1.totalDamages.total &&
          s2.traceCoords.length < s1.traceCoords.length)
      ) {
        return s2;
      }
      return s1;
    }
    case OptimizationTarget.RedDamage:
    case OptimizationTarget.BlueDamage:
    case OptimizationTarget.GreenDamage:
    case OptimizationTarget.YellowDamage:
    case OptimizationTarget.PurpleDamage: {
      const attr: ColoredPuyoAttribute =
        optTarget - OptimizationTarget.RedDamage + PuyoAttribute.Red;
      if (
        s2.totalDamages[attr] > s1.totalDamages[attr] ||
        (s2.totalDamages[attr] === s1.totalDamages[attr] &&
          s2.traceCoords.length < s1.traceCoords.length)
      ) {
        return s2;
      }
      return s1;
    }
    case OptimizationTarget.PuyoTsukaiCount: {
      if (
        s2.puyoTsukaiCount > s1.puyoTsukaiCount ||
        (s2.puyoTsukaiCount === s1.puyoTsukaiCount &&
          s2.traceCoords.length < s1.traceCoords.length)
      ) {
        return s2;
      }
      return s1;
    }
  }
};

/**
 * シミュレーターに対してなぞり消しを行って結果を求める。
 * @param simulator シミュレーター
 * @param traceCoords なぞり座標リスト
 * @returns
 */
const calcSolutionResult = (
  simulator: Simulator,
  traceCoords: PuyoCoord[]
): SolutionResult => {
  const sim = new Simulator(simulator.getSimulationData());
  sim.setTraceCoords(traceCoords);
  sim.doChains();

  const puyoTsukaiCount = Simulator.calcTotalPuyoTsukaiCount(sim.getChains());

  const totalDamages: Partial<TotalDamages> = Object.fromEntries(
    Simulator.colorAttrs.map((targetAttr) => {
      return [
        targetAttr,
        Simulator.calcTotalDamageOfTargetAttr(sim.getChains(), targetAttr)
      ];
    })
  );
  totalDamages.total = Object.keys(totalDamages).reduce((m, attr) => {
    return m + totalDamages[attr as '1']!;
  }, 0);

  return {
    traceCoords,
    puyoTsukaiCount,
    totalDamages: totalDamages as TotalDamages,
    chains: sim.getChains()
  };
};
