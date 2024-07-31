import type { Board } from './Board';
import type { SimulationData } from './SimulationData';
import { TraceMode } from './TraceMode';

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

  return parsed.board;
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
