/**
 * @module なぞりの最適解探索
 */

import {
  AllClearPreference,
  ChancePopPreference,
  CountingBonusType,
  OptimizationCategory,
  type OptimizationTarget
} from './OptimizationTarget';
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
  optimizationTarget: OptimizationTarget,
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
    optimizationTarget,
    calcSolutionResult(simulator, optimizationTarget, s.getTraceCoords())
  );

  for (const nextCoord of s.enumerateCandidates()) {
    advanceTrace(simulator, optimizationTarget, s, carry, nextCoord)!;
  }
};

const updateCarry = (
  carry: SolutionCarry,
  optimizationTarget: OptimizationTarget,
  solutionResult: SolutionResult
): void => {
  carry.solutionNums++;

  if (!carry.optimalSolution) {
    carry.optimalSolution = solutionResult;
    return;
  }

  carry.optimalSolution = betterSolution(
    optimizationTarget,
    carry.optimalSolution,
    solutionResult
  );
};

const betterSolutionByValue = (
  s1: SolutionResult,
  s2: SolutionResult
): SolutionResult | undefined => {
  if (s2.value > s1.value) {
    return s2;
  }
  if (s2.value < s1.value) {
    return s1;
  }
  return undefined;
};

const betterSolutionByTraceCoords = (
  s1: SolutionResult,
  s2: SolutionResult
): SolutionResult | undefined => {
  if (s2.traceCoords.length < s1.traceCoords.length) {
    return s2;
  }
  if (s2.traceCoords.length > s1.traceCoords.length) {
    return s1;
  }
  return undefined;
};

const betterSolutionByChancePopped = (
  s1: SolutionResult,
  s2: SolutionResult
): SolutionResult | undefined => {
  if (s2.chancePopped && !s1.chancePopped) {
    return s2;
  }
  if (!s2.chancePopped && s1.chancePopped) {
    return s1;
  }
  return undefined;
};

const betterSolutionByAllCleared = (
  s1: SolutionResult,
  s2: SolutionResult
): SolutionResult | undefined => {
  if (s2.allCleared && !s1.allCleared) {
    return s2;
  }
  if (!s2.allCleared && s1.allCleared) {
    return s1;
  }
  return undefined;
};

/**
 * s1 と s2 とで良い解法の方を返す。優劣付けれらない場合は s1 を返す。
 * @param s1
 * @param s2
 * @returns
 */
export const betterSolution = (
  optimizationTarget: OptimizationTarget,
  s1: SolutionResult,
  s2: SolutionResult
): SolutionResult => {
  switch (optimizationTarget.allClearPreference) {
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: false positive
    case AllClearPreference.NotCare:
      switch (optimizationTarget.chancePopPreference) {
        case ChancePopPreference.NotCare:
          return (
            betterSolutionByValue(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
        case ChancePopPreference.PreferIfBestValue:
          return (
            betterSolutionByValue(s1, s2) ??
            betterSolutionByChancePopped(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
        case ChancePopPreference.PreferIfExists:
          return (
            betterSolutionByChancePopped(s1, s2) ??
            betterSolutionByValue(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
      }
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: false positive
    case AllClearPreference.PreferIfBestValue:
      switch (optimizationTarget.chancePopPreference) {
        case ChancePopPreference.NotCare:
          return (
            betterSolutionByValue(s1, s2) ??
            betterSolutionByAllCleared(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
        case ChancePopPreference.PreferIfBestValue:
          return (
            betterSolutionByValue(s1, s2) ??
            betterSolutionByChancePopped(s1, s2) ??
            betterSolutionByAllCleared(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
        case ChancePopPreference.PreferIfExists:
          return (
            betterSolutionByChancePopped(s1, s2) ??
            betterSolutionByValue(s1, s2) ??
            betterSolutionByAllCleared(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
      }
    case AllClearPreference.PreferIfExists:
      switch (optimizationTarget.chancePopPreference) {
        case ChancePopPreference.NotCare:
          return (
            betterSolutionByAllCleared(s1, s2) ??
            betterSolutionByValue(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
        case ChancePopPreference.PreferIfBestValue:
          return (
            betterSolutionByAllCleared(s1, s2) ??
            betterSolutionByValue(s1, s2) ??
            betterSolutionByChancePopped(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
        case ChancePopPreference.PreferIfExists:
          return (
            betterSolutionByChancePopped(s1, s2) ??
            betterSolutionByAllCleared(s1, s2) ??
            betterSolutionByValue(s1, s2) ??
            betterSolutionByTraceCoords(s1, s2) ??
            s1
          );
      }
  }
};

/**
 * シミュレーターに対してなぞり消しを行って結果を求める。
 * @param simulator シミュレーター
 * @param optimizationTarget 最適化対象
 * @param traceCoords なぞり座標リスト
 * @returns
 */
const calcSolutionResult = (
  simulator: Simulator,
  optimizationTarget: OptimizationTarget,
  traceCoords: PuyoCoord[]
): SolutionResult => {
  const sim = new Simulator(simulator.getSimulationData());
  sim.setTraceCoords(traceCoords);
  sim.doChains();

  const chains = sim.getChains();
  const allCleared = Simulator.isAllCleared(chains);
  const chancePopped = Simulator.isChancePopped(chains);

  const totalDamages = Object.fromEntries(
    Simulator.colorAttrs.map((targetAttr) => {
      return [
        targetAttr,
        Simulator.calcTotalDamageOfTargetAttr(chains, targetAttr)
      ];
    })
  ) as Partial<TotalDamages> as TotalDamages;

  let value: number | undefined;

  switch (optimizationTarget.category) {
    case OptimizationCategory.Damage: {
      const mainValue = totalDamages[optimizationTarget.mainAttr]!;
      const subValue = optimizationTarget.subAttr
        ? totalDamages[optimizationTarget.subAttr] *
          (optimizationTarget.mainSubRatio ?? 0)
        : 0;
      value = mainValue + subValue;
      break;
    }
    case OptimizationCategory.PuyoCount: {
      const mainValue = Simulator.calcTotalCountOfTargetAttr(
        chains,
        optimizationTarget.mainAttr
      );
      let bonusValue = 0;
      if (optimizationTarget.countingBonus) {
        const countingBonus = optimizationTarget.countingBonus;
        switch (countingBonus.type) {
          case CountingBonusType.Step: {
            const totalHeight = countingBonus.targetAttrs.reduce(
              (m, attr) =>
                m + Simulator.calcTotalCountOfTargetAttr(chains, attr),
              0
            );
            let steps = Math.floor(totalHeight / countingBonus.stepHeight);
            if (!countingBonus.repeat) {
              steps = Math.min(1, steps);
            }
            bonusValue = countingBonus.bonusCount * steps;
          }
        }
      }
      value = mainValue + bonusValue;
      break;
    }
    case OptimizationCategory.PuyotsukaiCount: {
      value = Simulator.calcTotalPuyoTsukaiCount(chains);
      break;
    }
  }

  return {
    traceCoords,
    value: value!,
    totalDamages: totalDamages as TotalDamages,
    allCleared,
    chancePopped,
    chains
  };
};
