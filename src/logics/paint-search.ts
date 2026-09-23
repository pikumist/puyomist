import type { Board } from './Board';
import type { ExplorationTarget } from './ExplorationTarget';
import { type ColoredPuyoAttr, PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { type PuyoType, getPuyoAttr } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { SolutionMethod, type SolutionResult } from './solution';

/**
 * 「ぷよ塗り」探索。盤面の任意のマスを1色に塗り替える手を探す。
 *
 * 狙いが2つある ([`PaintGoal`])。
 *
 * - **仕込み**: 発火させずに連鎖しやすい形を作り、そのあと既存のなぞり消し探索にかける。
 *   方式と実測根拠は `docs/research/paint-search.md`
 * - **発火**: 塗った瞬間に連鎖を起こす。なぞりは要らない。
 *   方式と実測根拠は `docs/research/paint-ignition-search.md`
 *
 * 2つは**ハード制約が正反対の別物**で、探索方式も違う (仕込みはビームサーチ、
 * 発火は反復局所探索)。設定と結果の形だけを共有している。
 */

/** 塗りの狙い。塗ったあと「なぞる」のか「もう発火している」のか。 */
export enum PaintGoal {
  /** 発火させずに、なぞりで稼げる形を作る */
  Setup = 'setup',
  /** 塗った瞬間に連鎖を起こす */
  Ignite = 'ignite'
}

/** 狙いの表示名。短く、対になるように */
export const paintGoalNameMap = new Map<PaintGoal, string>([
  [PaintGoal.Setup, '仕込み'],
  [PaintGoal.Ignite, '発火']
]);

/** 狙いの説明。ダイアログの説明文に出す */
export const paintGoalDescriptionMap = new Map<PaintGoal, string>([
  [
    PaintGoal.Setup,
    '盤面を1色に塗り替えて、そのあとのなぞりで大きく稼げる形を作る。'
  ],
  [
    PaintGoal.Ignite,
    '盤面を1色に塗り替えて、塗った瞬間に連鎖を起こす。なぞりは要らない。'
  ]
]);

export const paintGoalList: ReadonlyArray<PaintGoal> = [
  PaintGoal.Setup,
  PaintGoal.Ignite
];

/** 探索精度。ビーム幅と検証件数はバックエンドをまたいで同じマッピングにする。 */
export enum PaintPrecision {
  /** 幅300 / 検証900 */
  Standard = 'standard',
  /** 幅1000 / 検証3000 */
  High = 'high',
  /** 幅2000 / 検証6000。Rustバックエンド限定 */
  Ultra = 'ultra'
}

/** 探索精度と説明のマップ */
export const paintPrecisionDescriptionMap = new Map<PaintPrecision, string>([
  [PaintPrecision.Standard, '標準'],
  [PaintPrecision.High, '高精度'],
  [PaintPrecision.Ultra, '超高精度']
]);

/**
 * WASM で選べる探索精度 (仕込み)。
 * 超高精度は単スレッドでは現実的な時間で終わらないため出さない。
 */
export const wasmPaintPrecisionList: ReadonlyArray<PaintPrecision> = [
  PaintPrecision.Standard,
  PaintPrecision.High
];

/** すべての探索精度 */
export const allPaintPrecisionList: ReadonlyArray<PaintPrecision> = [
  PaintPrecision.Standard,
  PaintPrecision.High,
  PaintPrecision.Ultra
];

/** Rustバックエンドで選べる探索精度 */
export const rustBackendPaintPrecisionList = allPaintPrecisionList;

/**
 * その探索法と狙いで選べる探索精度。
 *
 * **発火はどの探索法でも全部選べる**。仕込みと違って1回の評価が連鎖シミュレーション
 * 1回で済むので、wasm の超高精度でも約5.6秒で終わる (仕込みの標準が約16秒なのより短い)。
 * 実測は `docs/research/paint-ignition-search.md` §9-11。
 */
export const paintPrecisionListFor = (
  method: SolutionMethod,
  goal: PaintGoal = PaintGoal.Setup
): ReadonlyArray<PaintPrecision> => {
  if (goal === PaintGoal.Ignite) {
    return allPaintPrecisionList;
  }
  return method === SolutionMethod.solveAllByRustBackend
    ? rustBackendPaintPrecisionList
    : wasmPaintPrecisionList;
};

/** 塗り案1件 */
export interface PaintPlan {
  /** 塗るマス。空配列なら「塗らない」案 */
  coords: PuyoCoord[];
  /** 決定論評価での値 (探索対象によりダメージ量やぷよ使いカウント等) */
  value: number;
  /** 不確定ぷよの補充を織り込んだ期待値。求めていなければ undefined */
  expectedValue?: number;
  /** その塗り案での最適ななぞり */
  solution: SolutionResult;
}

/** ぷよ塗り探索の結果 */
export interface PaintSearchResult {
  /** 塗り案のリスト。良い順 */
  plans: PaintPlan[];
  /** 経過時間 (ms) */
  elapsedTime: number;
  /**
   * この結果を計算したときの入力の指紋 (`paintSearchSignatureOf`)。
   * 現在の入力と一致しない結果は古いので、表示にも適用にも使ってはいけない。
   */
  signature: string;
}

/** 塗りの取り消し用に控えた盤面 */
export interface PaintUndo {
  /** 塗る直前の盤面 */
  board: Board;
  /**
   * 塗った直後の盤面の指紋 (`boardSignatureOf`)。
   * 現在の盤面がこれと違うなら、塗ったあとに別の変更が入っている。
   * その状態で戻すとその変更まで巻き戻してしまうので、控えは捨てる。
   */
  boardSignature: string;
}

/** ぷよ塗り探索の設定 */
export interface PaintSearchSettings {
  /** 塗りの狙い。仕込みか発火か */
  goal: PaintGoal;
  /** 塗り色 */
  color: ColoredPuyoAttr;
  /** 塗り上限マス数 */
  maxPaintNum: number;
  /**
   * 最終検証で使う最大なぞり数。盤面設定の値とは独立させている。
   * **発火では使わない** (なぞらないので).
   *
   * 検証は精度に応じて数百〜数千件の盤面をそれぞれなぞり探索するので、なぞり数を
   * 上げた分のコストがその件数倍で効く。盤面のなぞり上限をそのまま使うと現実的な
   * 時間で終わらなくなるため、塗り探索側で別に抑えられるようにしてある。
   */
  maxTraceNum: number;
  /** 探索精度 */
  precision: PaintPrecision;
  /** 期待値も併記するかどうか (false なら決定論値だけ) */
  showExpectedValue: boolean;
}

/** ぷよ塗り探索設定の既定値 */
export const defaultPaintSearchSettings: PaintSearchSettings = {
  goal: PaintGoal.Setup,
  color: PuyoAttr.Red,
  maxPaintNum: 8,
  maxTraceNum: 5,
  precision: PaintPrecision.Standard,
  showExpectedValue: false
};

/** 塗り探索の最大なぞり数の上限。これ以上は待ち時間が現実的でなくなる */
export const paintMaxTraceNumLimit = 8;

/**
 * 盤面の指紋。ぷよの並び (ネクスト込み) だけを見る。
 *
 * 塗りの取り消しが「塗る前に戻す」だけを意味するように、盤面が別経路で
 * 変わっていないかを確かめるのに使う。
 */
export const boardSignatureOf = (simulationData: SimulationData): string => {
  const field = simulationData.field
    .map((row) => row.map((puyo) => puyo?.type ?? 0).join(','))
    .join('/');
  const next = simulationData.nextPuyos
    .map((puyo) => puyo?.type ?? 0)
    .join(',');
  return `${field}|${next}`;
};

/**
 * 探索結果の指紋。結果が依存する入力をすべて含める。
 *
 * 盤面・消し方のルール・ブーストエリア・探索対象・塗り設定のどれが変わっても
 * 結果は無効になる。探索中に設定を変えた場合も、返ってきた結果の指紋が現在の
 * ものと食い違うので取り込まれない。
 */
export const paintSearchSignatureOf = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  settings: PaintSearchSettings
): string => {
  const {
    goal,
    color,
    maxPaintNum,
    maxTraceNum,
    precision,
    showExpectedValue
  } = settings;
  const rule = [
    simulationData.minimumPuyoNumForPopping,
    simulationData.maxTraceNum,
    simulationData.traceMode,
    simulationData.poppingLeverage,
    simulationData.chainLeverage,
    simulationData.isChanceMode
  ].join(',');
  const boostArea = simulationData.boostAreaCoordList
    .map((coord) => coord.index)
    .sort((a, b) => a - b)
    .join(',');
  const paint = [
    goal,
    color,
    maxPaintNum,
    maxTraceNum,
    precision,
    showExpectedValue
  ].join(',');

  return [
    boardSignatureOf(simulationData),
    rule,
    boostArea,
    JSON.stringify(explorationTarget),
    paint
  ].join('#');
};

/**
 * 探索精度をその探索法で選べる範囲に丸める。
 * Rustバックエンドで超高精度を選んだままWASMへ切り替えると、選択肢に無い値が
 * 残って表示が壊れるため。
 */
export const clampPaintPrecision = (
  precision: PaintPrecision,
  available: ReadonlyArray<PaintPrecision>
): PaintPrecision =>
  available.includes(precision) ? precision : available[available.length - 1];

/**
 * そのマスを塗り色に塗り替えられるかどうか。
 *
 * プリズム・?ぷよ・空マスは塗れない。既に塗り色と同色の色ぷよは塗っても盤面が
 * 変わらないので候補から外す (プラス・チャンスは塗り替え後も維持されるため、
 * 同色ならプラス付きでも変化しない)。
 */
export const isPaintableType = (
  puyoType: PuyoType | undefined,
  color: ColoredPuyoAttr
): boolean => {
  if (puyoType === undefined) {
    return false;
  }
  const attr = getPuyoAttr(puyoType);
  if (
    attr === undefined ||
    attr === PuyoAttr.Prism ||
    attr === PuyoAttr.Question
  ) {
    return false;
  }
  return attr !== color;
};

/** 盤面から塗れるマスの座標を列挙する */
export const enumeratePaintableCoords = (
  simulationData: SimulationData,
  color: ColoredPuyoAttr
): PuyoCoord[] => {
  const coords: PuyoCoord[] = [];

  for (const [y, row] of simulationData.field.entries()) {
    for (const [x, puyo] of row.entries()) {
      if (isPaintableType(puyo?.type, color)) {
        coords.push(PuyoCoord.xyToCoord(x, y)!);
      }
    }
  }

  return coords;
};
