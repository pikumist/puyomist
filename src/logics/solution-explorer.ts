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
  PreferenceKind
} from './ExplorationTarget';
import { PuyoCoord } from './PuyoCoord';
import { isTraceablePuyo } from './PuyoType';
import { Simulator } from './Simulator';
import { createfilledOneBitFieldBeforeIndex } from './bit-field';
import {
  type ExplorationResult,
  type SolutionResult,
  SolutionState
} from './solution';

/**
 * @deprecated Rust版に集約する
 *
 * シミュレーターの最大なぞり消し数を超えない範囲で全てのなぞりを試して最適解を求める。
 * @param simulator シミュレーター
 * @param explorationTarget 探索対象
 * @returns
 */
export const solveAllTraces = (
  simulator: Simulator,
  explorationTarget: ExplorationTarget
): ExplorationResult => {
  const explorationResult: ExplorationResult = {
    candidates_num: 0,
    optimal_solutions: []
  };

  for (let y = 0; y < PuyoCoord.YNum; y++) {
    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const coord = PuyoCoord.xyToCoord(x, y)!;
      const state = new SolutionState(
        createfilledOneBitFieldBeforeIndex(coord.index),
        new Map()
      );
      advanceTrace(
        simulator,
        explorationTarget,
        state,
        coord,
        explorationResult
      );
    }
  }

  return explorationResult;
};

/**
 * @deprecated Rust版に集約する
 *
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
): ExplorationResult => {
  const explorationResult: ExplorationResult = {
    candidates_num: 0,
    optimal_solutions: []
  };

  advanceTrace(
    new Simulator(simulator.getSimulationData()),
    explorationTarget,
    new SolutionState(createfilledOneBitFieldBeforeIndex(index), new Map()),
    PuyoCoord.indexToCoord(index)!,
    explorationResult
  );

  return explorationResult;
};

const advanceTrace = (
  simulator: Simulator,
  explorationTarget: ExplorationTarget,
  state: SolutionState,
  coord: PuyoCoord,
  explorationResult: ExplorationResult
): void => {
  if (!isTraceablePuyo(simulator.getField()[coord.y][coord.x]?.type)) {
    return;
  }
  if (!state.checkIfAddableCoord(coord, simulator.getActualMaxTraceNum())) {
    return;
  }

  const s = SolutionState.clone(state);
  s.addTraceCoord(coord);

  updateExplorationResult(
    explorationTarget,
    calcSolutionResult(simulator, explorationTarget, s.getTraceCoords()),
    explorationResult
  );

  for (const nextCoord of s.enumerateCandidates()) {
    advanceTrace(
      simulator,
      explorationTarget,
      s,
      nextCoord,
      explorationResult
    )!;
  }
};

const updateExplorationResult = (
  explorationTarget: ExplorationTarget,
  solutionResult: SolutionResult,
  explorationResult: ExplorationResult
): void => {
  explorationResult.candidates_num++;
  mergeResultIfRankedIn(
    explorationTarget,
    solutionResult,
    explorationResult.optimal_solutions
  );
};

export const mergeResultIfRankedIn = (
  explorationTarget: ExplorationTarget,
  solutionResult: SolutionResult,
  optimalSolutions: SolutionResult[]
): void => {
  const max = explorationTarget.optimal_solution_count;
  if (max === 0) {
    return;
  }

  const len = optimalSolutions.length;
  const preferencePriorities = explorationTarget.preference_priorities;

  const pos =
    optimalSolutions.findLastIndex((s) => {
      const better = betterSolution(preferencePriorities, s, solutionResult);
      return better === s;
    }) + 1;
  if (pos === max) {
    return;
  }

  optimalSolutions.splice(pos, 0, solutionResult);
  if (len === max) {
    optimalSolutions.pop();
  }
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

  let value: number | undefined;

  switch (explorationTarget.category) {
    case ExplorationCategory.Damage: {
      if (!explorationTarget.main_attr) {
        value = Simulator.calcTotalWildDamage(chains);
      } else {
        const mainValue = Simulator.calcTotalDamageOfTargetAttr(
          chains,
          explorationTarget.main_attr
        );
        const subValue = explorationTarget.sub_attr
          ? Simulator.calcTotalDamageOfTargetAttr(
              chains,
              explorationTarget.sub_attr
            ) * (explorationTarget.main_sub_ratio ?? 0)
          : 0;
        value = mainValue + subValue;
      }
      break;
    }
    case ExplorationCategory.SkillPuyoCount: {
      const mainValue = Simulator.calcTotalCountOfTargetAttr(
        chains,
        explorationTarget.main_attr
      );
      let bonusValue = 0;
      if (explorationTarget.counting_bonus) {
        const countingBonus = explorationTarget.counting_bonus;
        switch (countingBonus.bonus_type) {
          case CountingBonusType.Step: {
            const totalHeight = countingBonus.target_attrs.reduce(
              (m, attr) =>
                m + Simulator.calcTotalCountOfTargetAttr(chains, attr),
              0
            );
            let steps = Math.floor(totalHeight / countingBonus.step_height);
            if (!countingBonus.repeat) {
              steps = Math.min(1, steps);
            }
            bonusValue = countingBonus.bonus_count * steps;
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

  const is_all_cleared = Simulator.isAllCleared(chains);
  const is_chance_popped = Simulator.isChancePopped(chains);
  const is_prism_popped = Simulator.isPrismPopped(chains);

  return {
    trace_coords: traceCoords,
    chains,
    value: value!,
    is_all_cleared,
    is_chance_popped,
    is_prism_popped
  };
};
