/**
 * @module なぞりの最適解探索
 * @license pikumist
 *
 * Copyright (c) pikumist. and its contributers.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind,
  wildAttribute
} from './ExplorationTarget';
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
 * @param explorationTarget 探索対象
 * @returns
 */
export const solveAllTraces = (
  simulator: Simulator,
  explorationTarget: ExplorationTarget
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
      advanceTrace(simulator, explorationTarget, state, carry, coord);
    }
  }

  const endTime = Date.now();
  const elapsedTime = endTime - startTime;

  return {
    explorationTarget: explorationTarget,
    elapsedTime,
    candidatesNum: carry.solutionNums,
    optimalSolution: carry.optimalSolution
  };
};

/**
 * なぞり開始位置を固定して最適解を求める。
 * @param simulator シミュレーター
 * @param explorationTarget 探索対象
 * @param index なぞり開始位置のインデックス (0-47)。これより若いインデックスを含むなぞりは探索されない。
 * @returns
 */
export const solveIncludingTraceIndex = (
  simulator: Simulator,
  explorationTarget: ExplorationTarget,
  index: number
): ExplorationResult | undefined => {
  const startTime = Date.now();

  const carry: SolutionCarry = {
    solutionNums: 0,
    optimalSolution: undefined
  };

  advanceTrace(
    new Simulator(simulator.getSimulationData()),
    explorationTarget,
    new SolutionState(createfilledOneBitFieldBeforeIndex(index), new Map()),
    carry,
    PuyoCoord.indexToCoord(index)!
  );

  const endTime = Date.now();
  const elapsedTime = endTime - startTime;

  return {
    explorationTarget: explorationTarget,
    elapsedTime,
    candidatesNum: carry.solutionNums,
    optimalSolution: carry.optimalSolution
  };
};

const advanceTrace = (
  simulator: Simulator,
  explorationTarget: ExplorationTarget,
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
    explorationTarget,
    calcSolutionResult(simulator, explorationTarget, s.getTraceCoords())
  );

  for (const nextCoord of s.enumerateCandidates()) {
    advanceTrace(simulator, explorationTarget, s, carry, nextCoord)!;
  }
};

const updateCarry = (
  carry: SolutionCarry,
  explorationTarget: ExplorationTarget,
  solutionResult: SolutionResult
): void => {
  carry.solutionNums++;

  if (!carry.optimalSolution) {
    carry.optimalSolution = solutionResult;
    return;
  }

  carry.optimalSolution = betterSolution(
    explorationTarget.preferencePriorities,
    carry.optimalSolution,
    solutionResult
  );
};

export type PartialSolutionResult = Omit<
  SolutionResult,
  'totalDamages' | 'totalWildDamage' | 'chains'
>;

const betterSolutionByValue = <S extends PartialSolutionResult>(
  s1: S,
  s2: S
): S | undefined => {
  if (s2.value > s1.value) {
    return s2;
  }
  if (s2.value < s1.value) {
    return s1;
  }
  return undefined;
};

const betterSolutionByChancePopped = <S extends PartialSolutionResult>(
  s1: S,
  s2: S
): S | undefined => {
  if (s2.is_chance_popped && !s1.is_chance_popped) {
    return s2;
  }
  if (!s2.is_chance_popped && s1.is_chance_popped) {
    return s1;
  }
  return undefined;
};

const betterSolutionByPrismPopped = <S extends PartialSolutionResult>(
  s1: S,
  s2: S
): S | undefined => {
  if (s2.is_prism_popped && !s1.is_prism_popped) {
    return s2;
  }
  if (!s2.is_prism_popped && s1.is_prism_popped) {
    return s1;
  }
  return undefined;
};

const betterSolutionByAllCleared = <S extends PartialSolutionResult>(
  s1: S,
  s2: S
): S | undefined => {
  if (s2.is_all_cleared && !s1.is_all_cleared) {
    return s2;
  }
  if (!s2.is_all_cleared && s1.is_all_cleared) {
    return s1;
  }
  return undefined;
};

const betterSolutionByTraceCoords = <S extends PartialSolutionResult>(
  s1: S,
  s2: S
): S | undefined => {
  if (s2.trace_coords.length < s1.trace_coords.length) {
    return s2;
  }
  if (s2.trace_coords.length > s1.trace_coords.length) {
    return s1;
  }
  return undefined;
};

const betterMethodMap = new Map([
  [PreferenceKind.BiggerValue, betterSolutionByValue],
  [PreferenceKind.ChancePop, betterSolutionByChancePopped],
  [PreferenceKind.PrismPop, betterSolutionByPrismPopped],
  [PreferenceKind.AllClear, betterSolutionByAllCleared],
  [PreferenceKind.SmallerTraceNum, betterSolutionByTraceCoords]
]);

/**
 * s1 と s2 とで良い解法の方を返す。優劣付けれらない場合は s1 を返す。
 * @param s1
 * @param s2
 * @returns
 */
export const betterSolution = <S extends PartialSolutionResult>(
  preferencePriorities: PreferenceKind[],
  s1: S,
  s2: S
): S => {
  for (const pref of preferencePriorities) {
    const betterMethod = betterMethodMap.get(pref);
    const s = betterMethod?.(s1, s2);
    if (s) {
      return s;
    }
  }
  return s1;
};

/**
 * シミュレーターに対してなぞり消しを行って結果を求める。
 * @param simulator シミュレーター
 * @param explorationTarget 探索対象
 * @param traceCoords なぞり座標リスト
 * @returns
 */
const calcSolutionResult = (
  simulator: Simulator,
  explorationTarget: ExplorationTarget,
  traceCoords: PuyoCoord[]
): SolutionResult => {
  const sim = new Simulator(simulator.getSimulationData());
  sim.setTraceCoords(traceCoords);
  sim.doChains();

  const chains = sim.getChains();
  const allCleared = Simulator.isAllCleared(chains);
  const chancePopped = Simulator.isChancePopped(chains);
  const prismPopped = Simulator.isPrismPopped(chains);

  const totalDamages = Object.fromEntries(
    Simulator.colorAttrs.map((targetAttr) => {
      return [
        targetAttr,
        Simulator.calcTotalDamageOfTargetAttr(chains, targetAttr)
      ];
    })
  ) as Partial<TotalDamages> as TotalDamages;

  const totalWildDamage = Simulator.calcTotalWildDamage(chains);

  let value: number | undefined;

  switch (explorationTarget.category) {
    case ExplorationCategory.Damage: {
      if (explorationTarget.mainAttr === wildAttribute) {
        value = totalWildDamage;
      } else {
        const mainValue = totalDamages[explorationTarget.mainAttr]!;
        const subValue = explorationTarget.subAttr
          ? totalDamages[explorationTarget.subAttr] *
            (explorationTarget.mainSubRatio ?? 0)
          : 0;
        value = mainValue + subValue;
      }
      break;
    }
    case ExplorationCategory.SkillPuyoCount: {
      const mainValue = Simulator.calcTotalCountOfTargetAttr(
        chains,
        explorationTarget.mainAttr
      );
      let bonusValue = 0;
      if (explorationTarget.countingBonus) {
        const countingBonus = explorationTarget.countingBonus;
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
    case ExplorationCategory.PuyotsukaiCount: {
      value = Simulator.calcTotalPuyoTsukaiCount(chains);
      break;
    }
  }

  return {
    trace_coords: traceCoords,
    value: value!,
    totalDamages: totalDamages as TotalDamages,
    totalWildDamage,
    is_all_cleared: allCleared,
    is_chance_popped: chancePopped,
    is_prism_popped: prismPopped,
    chains
  };
};
