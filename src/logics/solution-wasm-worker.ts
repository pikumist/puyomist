import { expose } from 'comlink';
import init, {
  paint_build_plans,
  paint_evaluate_sets,
  paint_expand_beam,
  paint_select_top,
  solve_all_traces,
  solve_traces_including_index,
  solve_traces_with_prefix
} from '../../packages/solver-wasm/pkg/solver';
import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { ExplorationResult } from './solution';
import type {
  WasmExplorationResult,
  WasmPaintEvaluation,
  WasmPaintPlan,
  WasmPaintSearchParams,
  WasmPaintSet
} from './wasm-interface';
import {
  toJsOptimalSolution,
  toWasmEnvironmentFieldNextPuyos,
  toWasmExplorationTarget
} from './wasm-serialize';

const initPromise = init();

export async function solveAllTraces(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
): Promise<ExplorationResult> {
  await initPromise;
  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_all_traces(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimal_solutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidates_num: solved.candidates_num,
    optimal_solutions
  };

  return result;
}

export async function solveIncludingTraceIndex(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  index: number
) {
  await initPromise;

  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_traces_including_index(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos,
    index
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimal_solutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidates_num: solved.candidates_num,
    optimal_solutions
  };

  return result;
}

export async function solveWithPrefix(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  prefix: number[],
  recurse: boolean
) {
  await initPromise;

  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_traces_with_prefix(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos,
    prefix,
    recurse
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimal_solutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidates_num: solved.candidates_num,
    optimal_solutions
  };

  return result;
}

///
/// 前段「ぷよ塗り」探索。
///
/// 1呼び出しで完結させると wasm の単スレッドでは幅300でも約19秒かかり、その間
/// 何も返せない。段ごとに分けてあるので、呼び出し側 (paint-search-worker-driver)
/// が重い `evaluatePaintSets` だけを複数ワーカーへ配れる。
///

/** ビームを1段展開する。空が返ったら打ち切ること */
export async function expandPaintBeam(
  simulationData: SimulationData,
  params: WasmPaintSearchParams,
  beam: WasmPaintSet[]
): Promise<WasmPaintSet[]> {
  await initPromise;

  const { field, next_puyos } = toWasmEnvironmentFieldNextPuyos(simulationData);

  return paint_expand_beam(
    field,
    next_puyos,
    params,
    simulationData.minimumPuyoNumForPopping,
    beam
  ) as WasmPaintSet[];
}

/**
 * 塗り集合をまとめて評価する。ここだけが重い。
 *
 * **返る評価は渡した順のまま**。呼び出し側が分割したときは、この順序を保ったまま
 * 元の並びに戻すこと。崩すと同点の並びが変わってRustバックエンドと食い違う。
 */
export async function evaluatePaintSets(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  params: WasmPaintSearchParams,
  paintSets: WasmPaintSet[],
  maxTraceNum: number,
  withSolution: boolean,
  withUncertainty: boolean
): Promise<WasmPaintEvaluation[]> {
  await initPromise;

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  return paint_evaluate_sets(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos,
    params,
    paintSets,
    maxTraceNum,
    withSolution,
    withUncertainty
  ) as WasmPaintEvaluation[];
}

/** スコアの大きい順に上位 count 件の添字を返す (タイブレークをRustに合わせるため) */
export async function selectTopPaintSets(
  scores: number[],
  count: number
): Promise<number[]> {
  await initPromise;
  return paint_select_top(scores, count) as number[];
}

/** 評価済みの塗り集合を良い順に並べて塗り案にする */
export async function buildPaintPlans(
  explorationTarget: ExplorationTarget,
  paintSets: WasmPaintSet[],
  evaluations: WasmPaintEvaluation[],
  resultNum: number
): Promise<WasmPaintPlan[]> {
  await initPromise;

  return paint_build_plans(
    toWasmExplorationTarget(explorationTarget),
    paintSets,
    evaluations,
    resultNum
  ) as WasmPaintPlan[];
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex,
  solveWithPrefix,
  expandPaintBeam,
  evaluatePaintSets,
  selectTopPaintSets,
  buildPaintPlans
});
