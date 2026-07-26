import type { Board } from './Board';
import type { ExplorationTarget } from './ExplorationTarget';
import { type ColoredPuyoAttr, PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { type PuyoType, getPuyoAttr } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { SolutionMethod, type SolutionResult } from './solution';

/**
 * 前段「ぷよ塗り」探索。
 *
 * 盤面の任意のマスを1色に塗り替えて連鎖しやすい盤面を作り、そのあとで既存の
 * なぞり消し探索にかける。方式の詳細と実測根拠は `docs/paint-search.md` を参照。
 */

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
 * WASM で選べる探索精度。
 * 超高精度は単スレッドでは現実的な時間で終わらないため出さない。
 */
export const wasmPaintPrecisionList: ReadonlyArray<PaintPrecision> = [
  PaintPrecision.Standard,
  PaintPrecision.High
];

/** Rustバックエンドで選べる探索精度 */
export const rustBackendPaintPrecisionList: ReadonlyArray<PaintPrecision> = [
  PaintPrecision.Standard,
  PaintPrecision.High,
  PaintPrecision.Ultra
];

/** その探索法で選べる探索精度 */
export const paintPrecisionListFor = (
  method: SolutionMethod
): ReadonlyArray<PaintPrecision> =>
  method === SolutionMethod.solveAllByRustBackend
    ? rustBackendPaintPrecisionList
    : wasmPaintPrecisionList;

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
  /** 塗り色 */
  color: ColoredPuyoAttr;
  /** 塗り上限マス数 */
  maxPaintNum: number;
  /** 探索精度 */
  precision: PaintPrecision;
  /** 期待値も併記するかどうか (false なら決定論値だけ) */
  showExpectedValue: boolean;
}

/** ぷよ塗り探索設定の既定値 */
export const defaultPaintSearchSettings: PaintSearchSettings = {
  color: PuyoAttr.Red,
  maxPaintNum: 8,
  precision: PaintPrecision.Standard,
  showExpectedValue: false
};

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
  const { color, maxPaintNum, precision, showExpectedValue } = settings;
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
  const paint = [color, maxPaintNum, precision, showExpectedValue].join(',');

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

/**
 * 見た目確認用のモック探索。
 *
 * TODO: WASM バインディング (`expand_paint_beam` / `evaluate_paint_sets`) と
 * Rustバックエンドの `{type:"paint"}` が入り次第、丸ごと差し替える。
 * 実探索と同じ形の結果を、盤面から決まる擬似乱数で組み立てているだけで、
 * ハード制約 (塗り後に1つも消えないこと) は満たしていない。
 */
export const createMockPaintSearchResult = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  settings: PaintSearchSettings
): PaintSearchResult => {
  const candidates = enumeratePaintableCoords(simulationData, settings.color);

  // 盤面と設定から決まる決定論的な擬似乱数。同じ盤面なら毎回同じ結果になる。
  let seed = settings.color * 31 + settings.maxPaintNum;
  for (const row of simulationData.field) {
    for (const puyo of row) {
      seed = (seed * 33 + (puyo?.type ?? 0)) % 0x7fffffff;
    }
  }
  const nextRandom = () => {
    seed = (seed * 1103515245 + 12345) % 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const planNum = 10;
  const plans: PaintPlan[] = [];

  for (let i = 0; i < planNum && candidates.length > 0; i++) {
    const paintNum = Math.max(
      1,
      Math.min(settings.maxPaintNum, candidates.length) - (i % 3)
    );
    const picked = new Set<PuyoCoord>();
    while (picked.size < paintNum) {
      picked.add(candidates[Math.floor(nextRandom() * candidates.length)]);
    }
    const coords = [...picked].sort((a, b) => a.index - b.index);
    const value = 240 - i * 6 - Math.floor(nextRandom() * 3) * 3;

    plans.push({
      coords,
      value,
      expectedValue: settings.showExpectedValue
        ? Math.round(value * 1.2 + nextRandom() * 20)
        : undefined,
      solution: createMockSolution(coords, value)
    });
  }

  // 「塗らない」案は代理評価を通らないので、無条件で候補に加える。
  // 塗りがすべて損な盤面ではこれが答えになる。
  plans.push({
    coords: [],
    value: 96,
    expectedValue: settings.showExpectedValue ? 118 : undefined,
    solution: createMockSolution([], 96)
  });

  return {
    plans,
    elapsedTime: 5400,
    signature: paintSearchSignatureOf(
      simulationData,
      explorationTarget,
      settings
    )
  };
};

const createMockSolution = (
  paintCoords: PuyoCoord[],
  value: number
): SolutionResult => {
  // なぞりは塗ったマスの近くから始まることが多いので、そこを起点に横に伸ばす。
  const origin = paintCoords[0] ?? PuyoCoord.xyToCoord(0, 5)!;
  const traceCoords = [0, 1, 2]
    .map((dx) => PuyoCoord.xyToCoord(origin.x + dx, origin.y))
    .filter((coord): coord is PuyoCoord => Boolean(coord));

  return {
    trace_coords: traceCoords,
    chains: [],
    value,
    popped_chance_num: 0,
    popped_heart_num: 0,
    popped_prism_num: 0,
    popped_ojama_num: 0,
    popped_kata_num: 0,
    is_all_cleared: false
  };
};
