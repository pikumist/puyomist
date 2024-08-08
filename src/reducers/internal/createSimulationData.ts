import type { Board } from '../../logics/Board';
import { PuyoCoord } from '../../logics/PuyoCoord';
import type { SimulationData } from '../../logics/SimulationData';
import { Simulator } from '../../logics/Simulator';
import { TraceMode } from '../../logics/TraceMode';
import { createPuyo } from './createPuyo';

/**
 * ボード情報やオプションからシミュレーションデータを生成する。
 * 足りない情報はデフォルトで補完する。
 * 採用順は、strongOptions > board > weakOptions > default
 * @param board
 * @param strongOptions
 * @param weakOptions
 * @returns
 */
export const createSimulationData = (
  board: Partial<Board>,
  strongOptions: Partial<SimulationData> = {},
  weakOptions: Partial<SimulationData> = {}
): SimulationData => {
  const nextPuyos =
    strongOptions.nextPuyos ??
    (board.nextPuyos
      ? board.nextPuyos.map(createPuyo)
      : weakOptions.nextPuyos ?? [...new Array(PuyoCoord.XNum)]);
  const field =
    strongOptions.field ??
    (board.field
      ? board.field.map((row) => row.map(createPuyo))
      : weakOptions.field ??
        [...new Array(PuyoCoord.YNum)].map(() => [
          ...new Array(PuyoCoord.XNum)
        ]));
  const boostAreaCoordList =
    strongOptions.boostAreaCoordList ?? weakOptions.boostAreaCoordList ?? [];
  const isChanceMode =
    strongOptions.isChanceMode ?? Boolean(board.isChanceMode);
  const traceCoords =
    strongOptions.traceCoords ?? weakOptions.traceCoords ?? [];
  const minimumPuyoNumForPopping =
    strongOptions.minimumPuyoNumForPopping ??
    board.minimumPuyoNumForPopping ??
    weakOptions.minimumPuyoNumForPopping ??
    Simulator.defaultMinimumPuyoNumForPopping;
  const maxTraceNum =
    strongOptions.maxTraceNum ??
    board.maxTraceNum ??
    weakOptions.maxTraceNum ??
    Simulator.defaultMaxTraceNum;
  const traceMode =
    strongOptions.traceMode ??
    board.traceMode ??
    weakOptions.traceMode ??
    TraceMode.Normal;
  const poppingLeverage =
    strongOptions.poppingLeverage ??
    board.poppingLeverage ??
    weakOptions.poppingLeverage ??
    1.0;
  const chainLeverage =
    strongOptions.chainLeverage ??
    board.chainLeverage ??
    weakOptions.chainLeverage ??
    1.0;

  return {
    nextPuyos,
    field,
    boostAreaCoordList,
    isChanceMode,
    traceCoords,
    minimumPuyoNumForPopping,
    maxTraceNum,
    traceMode,
    poppingLeverage,
    chainLeverage
  };
};
