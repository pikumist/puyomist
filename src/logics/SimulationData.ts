import type { Puyo } from './Puyo';
import type { PuyoCoord } from './PuyoCoord';
import type { TraceMode } from './TraceMode';

/** なぞり消しシミュレーションするのに必要なデータ */
export interface SimulationData {
  /** ネクストぷよ8個分 */
  nextPuyos: (Puyo | undefined)[];
  /** フィールドぷよ8x6個分 */
  field: (Puyo | undefined)[][];
  /** ブーストエリア座標リスト */
  boostAreaCoordList: PuyoCoord[];
  /** チャンスモードかどうか。チャンスモード中は最大なぞり消し数が5に固定される。 */
  isChanceMode: boolean;
  /** 現在のなぞり座標リスト */
  traceCoords: PuyoCoord[];
  /** ぷよが消えるのに必要な個数 */
  minimumPuyoNumForPopping: number;
  /** 最大なぞり消し数 */
  maxTraceNum: number;
  /** なぞり消しモード。*/
  traceMode: TraceMode;
  /** なぞり消し倍率 */
  poppingLeverage: number;
  /** 連鎖倍率 */
  chainLeverage: number;
  /** アニメーション間隔 (ms) */
  animationDuration: number;
}

/**
 * SimulationDataを複製する。
 * Redux Thunk (tracingFinished) 中でデータがfreezeされてしまうので、freeze状態を戻すために使う。
 */
export const cloneSimulationData = (
  simulationData: SimulationData
): SimulationData => {
  const nextPuyos = [...simulationData.nextPuyos];
  const field = simulationData.field.map((row) => [...row]);
  const boostAreaCoordList = simulationData.boostAreaCoordList;
  const isChanceMode = simulationData.isChanceMode;
  const traceCoords = [...simulationData.traceCoords];
  const minimumPuyoNumForPopping = simulationData.minimumPuyoNumForPopping;
  const maxTraceNum = simulationData.maxTraceNum;
  const traceMode = simulationData.traceMode;
  const poppingLeverage = simulationData.poppingLeverage;
  const chainLeverage = simulationData.chainLeverage;
  const animationDuration = simulationData.animationDuration;

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
    chainLeverage,
    animationDuration
  };
};
