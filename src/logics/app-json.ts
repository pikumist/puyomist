import type { Board } from './Board';
import { boostAreaKeyMap } from './BoostArea';
import {
  type ExplorationTarget,
  explorationCategoryDescriptionMap,
  preferenceKindDescriptionMap
} from './ExplorationTarget';
import type { PuyoType } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { TraceMode } from './TraceMode';

/** Boardを検証する。問題があればエラー文字列を返す。なければ undefined を返す。 */
const validateBoard = (board: Partial<Board>): string | undefined => {
  if (!board.nextPuyos || board.nextPuyos.length !== 8) {
    return 'nextPuyosが不正';
  }
  if (
    !board.field ||
    board.field.length !== 6 ||
    !board.field.every((row) => row?.length === 8)
  ) {
    return 'fieldが不正';
  }
  if (typeof board.isChanceMode !== 'boolean') {
    return 'isChanceModeが不正';
  }
  if (
    !board.minimumPuyoNumForPopping ||
    !(board.minimumPuyoNumForPopping >= 3)
  ) {
    return 'minimumPuyoNumForPoppingが不正';
  }
  if (!board.maxTraceNum || !(board.maxTraceNum >= 1)) {
    return 'maxTraceNumが不正';
  }
  if (!board.poppingLeverage || !(board.poppingLeverage >= 1)) {
    return 'poppingLeverageが不正';
  }
  if (!board.chainLeverage || !(board.chainLeverage >= 1)) {
    return 'chainLeverageが不正';
  }
  if (
    !(
      (board.traceMode as number) >= TraceMode.Normal &&
      (board.traceMode as number) <= TraceMode.ToPurple
    )
  ) {
    return 'traceModeが不正';
  }
};

export const parseBoardJson = (jsonText: string): Board | string => {
  const parsed = JSON.parse(jsonText) as Partial<{
    type: 'board';
    board: Board;
  }>;

  if (!parsed) {
    return 'JSONが不正';
  }
  if (parsed.type !== 'board') {
    return 'typeがboardでない';
  }
  if (!parsed.board) {
    return 'boardがない';
  }

  const board = parsed.board;
  const error = validateBoard(board);
  if (error) {
    return error;
  }

  return board;
};

export const toBoardJson = (simulationData: SimulationData): string => {
  const field = simulationData.field.map((row) =>
    row.map((cell) => cell?.type)
  );
  const nextPuyos = simulationData.nextPuyos.map((cell) => cell?.type);
  const isChanceMode = simulationData.isChanceMode;
  const traceMode = simulationData.traceMode;
  const minimumPuyoNumForPopping = simulationData.minimumPuyoNumForPopping;
  const poppingLeverage = simulationData.poppingLeverage;
  const chainLeverage = simulationData.chainLeverage;
  const maxTraceNum = simulationData.maxTraceNum;

  return JSON.stringify({
    type: 'board',
    board: {
      field,
      nextPuyos,
      isChanceMode,
      traceMode,
      minimumPuyoNumForPopping,
      poppingLeverage,
      chainLeverage,
      maxTraceNum
    }
  });
};

export interface PuyomistJson {
  type: 'puyomist';
  board: {
    field: (PuyoType | undefined)[][];
    nextPuyos: (PuyoType | undefined)[];
    isChanceMode: boolean;
    traceMode: TraceMode;
    minimumPuyoNumForPopping: number;
    poppingLeverage: number;
    chainLeverage: number;
    maxTraceNum: number;
  };
  boostAreaKeyList: string[];
  explorationTarget: ExplorationTarget;
}

export const parsePuyomistJson = (jsonText: string): PuyomistJson | string => {
  const parsed = JSON.parse(jsonText) as Partial<PuyomistJson>;

  if (!parsed) {
    return 'JSONが不正';
  }
  if (parsed.type !== 'puyomist') {
    return 'typeがpuyomistでない';
  }
  if (!parsed.board) {
    return 'boardがない';
  }

  const board = parsed.board;

  const errorBoard = validateBoard(board);
  if (errorBoard) {
    return errorBoard;
  }

  const keyList = parsed.boostAreaKeyList;
  if (!keyList) {
    return 'boostAreaKeyListが配列でない';
  }
  for (const key of keyList) {
    if (!boostAreaKeyMap.has(key)) {
      return 'boostAreaKeyListのキーが不正';
    }
  }

  const target = parsed.explorationTarget;
  if (!target) {
    return 'explorationTargetが不正';
  }
  const category = target.category;
  if (!explorationCategoryDescriptionMap.has(category)) {
    return 'explorationTargetのcategoryが不正';
  }
  const priorities = target.preference_priorities;
  if (!priorities) {
    return 'explorationTarget.preference_prioritiesが配列でない';
  }
  for (const priority of priorities) {
    if (!preferenceKindDescriptionMap.has(priority)) {
      return 'explorationTarget.preference_prioritiesに不正な値がある';
    }
  }
  if (!(target.optimal_solution_count > 0)) {
    return 'explorationTarget.optimal_solution_countが1以上でない';
  }

  return parsed as PuyomistJson;
};

export const toPuyomistJson = (
  simulationData: SimulationData,
  boostAreaKeyList: string[],
  explorationTarget: ExplorationTarget
): string => {
  const field = simulationData.field.map((row) =>
    row.map((cell) => cell?.type)
  );
  const nextPuyos = simulationData.nextPuyos.map((cell) => cell?.type);
  const isChanceMode = simulationData.isChanceMode;
  const traceMode = simulationData.traceMode;
  const minimumPuyoNumForPopping = simulationData.minimumPuyoNumForPopping;
  const poppingLeverage = simulationData.poppingLeverage;
  const chainLeverage = simulationData.chainLeverage;
  const maxTraceNum = simulationData.maxTraceNum;

  return JSON.stringify({
    type: 'puyomist',
    board: {
      field,
      nextPuyos,
      isChanceMode,
      traceMode,
      minimumPuyoNumForPopping,
      poppingLeverage,
      chainLeverage,
      maxTraceNum
    },
    boostAreaKeyList,
    explorationTarget
  } as PuyomistJson);
};
