import { type ColoredPuyoAttr, PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { type PuyoType, getPuyoAttr } from './PuyoType';
import type { SimulationData } from './SimulationData';
import type { SolutionResult } from './solution';

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

  return { plans, elapsedTime: 5400 };
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
