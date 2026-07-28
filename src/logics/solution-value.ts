/**
 * @module 連鎖結果から探索対象の値を求める
 * @license pikumist
 *
 * Copyright (c) pikumist. and its contributers.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Chain } from './Chain';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget
} from './ExplorationTarget';
import { PuyoAttr } from './PuyoAttr';
import type { PuyoCoord } from './PuyoCoord';
import type { SimulationData } from './SimulationData';
import { Simulator } from './Simulator';
import type { SolutionResult } from './solution';

/**
 * 連鎖結果から探索対象の値を求める。
 * ダメージ量だったり、スキル溜め数だったり、ぷよ使いカウントだったりする。
 */
export const calcValueOfChains = (
  chains: Chain[],
  explorationTarget: ExplorationTarget
): number => {
  switch (explorationTarget.category) {
    case ExplorationCategory.Damage: {
      if (!explorationTarget.main_attr) {
        return Simulator.calcTotalWildDamage(chains);
      }
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
      return mainValue + subValue;
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
      return mainValue + bonusValue;
    }
    case ExplorationCategory.PuyotsukaiCount: {
      return Simulator.calcTotalPuyoTsukaiCount(chains);
    }
  }
};

/** 連鎖結果から解の情報を組み立てる。 */
export const calcSolutionResultOfChains = (
  traceCoords: PuyoCoord[],
  chains: Chain[],
  explorationTarget: ExplorationTarget
): SolutionResult => {
  return {
    trace_coords: traceCoords,
    chains,
    value: calcValueOfChains(chains, explorationTarget),
    popped_chance_num: Simulator.calcPoppedChanceNum(chains),
    popped_prism_num: Simulator.calcTotalCountOfTargetAttr(
      chains,
      PuyoAttr.Prism
    ),
    popped_heart_num: Simulator.calcTotalCountOfTargetAttr(
      chains,
      PuyoAttr.Heart
    ),
    popped_ojama_num: Simulator.calcTotalCountOfTargetAttr(
      chains,
      PuyoAttr.Ojama
    ),
    popped_kata_num: Simulator.calcTotalCountOfTargetAttr(
      chains,
      PuyoAttr.Kata
    ),
    is_all_cleared: Simulator.isAllCleared(chains)
  };
};

/** 指定のなぞりでシミュレートし、連鎖結果を返す。 */
export const simulateTrace = (
  simulationData: SimulationData,
  traceCoords: PuyoCoord[]
): Chain[] => {
  const sim = new Simulator(simulationData);
  sim.setTraceCoords(traceCoords);
  sim.doChains();
  return sim.getChains();
};

/** 指定のなぞりでシミュレートし、解の情報を求める。 */
export const simulateSolution = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  traceCoords: PuyoCoord[]
): SolutionResult => {
  return calcSolutionResultOfChains(
    traceCoords,
    simulateTrace(simulationData, traceCoords),
    explorationTarget
  );
};
