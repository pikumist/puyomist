/**
 * @module プラス付与案の算出
 * @license pikumist
 *
 * Copyright (c) pikumist. and its contributers.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Board } from './Board';
import type { Chain } from './Chain';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget
} from './ExplorationTarget';
import { type ColoredPuyoAttr, PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import {
  getPuyoAttr,
  isColoredPuyoType,
  isPlusPuyo,
  toPlusColoredType
} from './PuyoType';
import type { SimulationData } from './SimulationData';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import { boardSignatureOf } from './paint-search';
import { calcValueOfChains, simulateTrace } from './solution-value';

/**
 * 既に決まっている消し方に対する「どのマスをプラスぷよにすると値が伸びるか」の算出。
 *
 * プラスは消える判定に一切影響しない (`Simulator.detectPopBlocks` は色しか見ない) ので、
 * プラスを付けても連鎖の構造は変わらず、変わるのは数え方だけ。つまりこれは探索ではなく
 * 厳密計算で済む。各マスの寄与は「そのマスだけプラスにして再シミュレートした差分」で求める。
 *
 * ブーストエリアの内外判定は**消える瞬間の座標**で決まる (ぷよは落ちてから消える) ため、
 * 初期位置がエリア内かどうかで代用してはいけない。再シミュレートすれば自動的に正しく入る。
 */

/** プラス付与数の上限 (フィールドの全マス) */
export const plusAssignMaxNumLimit = PuyoCoord.XNum * PuyoCoord.YNum;

/**
 * プラス付与案の優先度の種類。
 *
 * 探索の好み (`PreferenceKind`) と同じ辞書式で使う。上のものから順に比べ、
 * 同点なら次のもので優劣を付ける。
 */
export enum PlusPreferenceKind {
  /**
   * 探索対象の値が大きい。
   *
   * マス同士を比べるときはそのマス単独の増分を使うが、**選抜は組全体の値の最大化**で行う
   * (ブースト倍率や段ボーナスのせいで、単独の増分の合計と組の値は一致しないため)。
   * 結果として、単独増分がわずかに小さいマスが選ばれることがある。
   */
  BiggerValue = 1,
  /** 選んだ色の色ぷよである */
  ColoredPuyo = 2
}

/** 優先度の種類とその説明のマップ */
export const plusPreferenceKindDescriptionMap: ReadonlyMap<
  PlusPreferenceKind,
  string
> = new Map([
  [PlusPreferenceKind.BiggerValue, '探索対象の値が大きい'],
  [PlusPreferenceKind.ColoredPuyo, '色ぷよ']
]);

/** 優先度の既定の並び */
export const defaultPlusPreferencePriorities: ReadonlyArray<PlusPreferenceKind> =
  [PlusPreferenceKind.BiggerValue, PlusPreferenceKind.ColoredPuyo];

/**
 * 優先度リストを「既知の種類がちょうど1回ずつ」に整える。
 * 種類は増減させず並べ替えるだけの UI なので、欠けや重複は壊れた入力とみなして直す。
 */
export const normalizePlusPreferencePriorities = (
  priorities: readonly PlusPreferenceKind[] | undefined
): PlusPreferenceKind[] => {
  const seen = new Set<PlusPreferenceKind>();
  const result: PlusPreferenceKind[] = [];

  for (const pref of priorities ?? []) {
    if (plusPreferenceKindDescriptionMap.has(pref) && !seen.has(pref)) {
      seen.add(pref);
      result.push(pref);
    }
  }
  for (const pref of defaultPlusPreferencePriorities) {
    if (!seen.has(pref)) {
      result.push(pref);
    }
  }

  return result;
};

/** プラス付与案の設定 */
export interface PlusAssignSettings {
  /** 盤面にプラス付与案を重ねるかどうか */
  enabled: boolean;
  /** プラスを付けられる数 */
  num: number;
  /** 優先度。上のものから順に比べ、同点なら次のもので優劣を付ける。 */
  priorities: PlusPreferenceKind[];
  /** 「色ぷよ」優先で狙う色 */
  color: ColoredPuyoAttr;
}

/** プラス付与案の既定の設定 */
export const defaultPlusAssignSettings: PlusAssignSettings = {
  enabled: false,
  num: 8,
  priorities: [...defaultPlusPreferencePriorities],
  color: PuyoAttr.Red
};

/** プラス付与の候補マス1つ分 */
export interface PlusAssignCandidate {
  /** 候補マス */
  coord: PuyoCoord;
  /** そのマスの色 */
  attr: ColoredPuyoAttr;
  /** そのマスだけをプラスにしたときの値の増分 */
  gain: number;
  /**
   * 非線形項に効くマスかどうか。
   * ダメージならブーストカウント (倍率)、スキル溜めなら加算ボーナスの段。
   */
  affectsBonus: boolean;
  /** なぞりで直接消えるぷよかどうか。連鎖に寄与しないので優先度を最低にする。 */
  poppedByTrace: boolean;
}

/** プラス付与案 */
export interface PlusAssignPlan {
  /** プラスを付けるマス。良い順。 */
  coords: PuyoCoord[];
  /** 各マスを単独でプラスにしたときの増分 (`coords` と同順) */
  gains: number[];
  /** 付与前の値 */
  baseValue: number;
  /** 付与後の値。選んだマス全部にプラスを付けて実際にシミュレートした値。 */
  value: number;
  /** プラスを付けられるマスの総数 (上限で切る前) */
  candidateNum: number;
}

/** プラス付与案の指紋。案が依存する入力をすべて含める。 */
export const plusAssignSignatureOf = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  traceCoords: PuyoCoord[],
  settings: PlusAssignSettings
): string => {
  const rule = [
    simulationData.minimumPuyoNumForPopping,
    simulationData.traceMode,
    simulationData.poppingLeverage,
    simulationData.chainLeverage
  ].join(',');
  const boostArea = simulationData.boostAreaCoordList
    .map((coord) => coord.index)
    .sort((a, b) => a - b)
    .join(',');
  const trace = traceCoords.map((coord) => coord.index).join(',');

  return [
    boardSignatureOf(simulationData),
    rule,
    boostArea,
    JSON.stringify(explorationTarget),
    trace,
    settings.num,
    normalizePlusPreferencePriorities(settings.priorities).join(','),
    settings.color
  ].join('#');
};

/** プラス付与の取り消し用に控えた盤面 */
export interface PlusAssignUndo {
  /** 付与する直前の盤面 */
  board: Board;
  /**
   * 付与した直後の盤面の指紋 (`boardSignatureOf`)。
   * 現在の盤面がこれと違うなら、付与したあとに別の変更が入っている。
   */
  boardSignature: string;
}

/** 指定マスにプラスを付けた盤面データを作る。 */
const withPlusAt = (
  simulationData: SimulationData,
  coords: readonly PuyoCoord[]
): SimulationData => {
  const field = simulationData.field.map((row) => [...row]);
  for (const coord of coords) {
    // 呼び出し元が候補マス (色ぷよのあるマス) しか渡さないので空マスは来ない
    const puyo = field[coord.y][coord.x]!;
    field[coord.y][coord.x] = { ...puyo, type: toPlusColoredType(puyo.type) };
  }
  return { ...simulationData, field };
};

/**
 * 非線形項の量を測る関数を作る。
 *
 * この量を固定すれば残りは各マスの寄与の単純な和になるので、
 * 「この量に効くマスから j 個・効かないマスから N-j 個」で j を回せば厳密に最適な組が出る。
 *
 * > **前提**: 効くマスは1個につきこの量をちょうど +1 する。
 * > ぷよは1回しか消えず、`getPuyoAttr` は1属性しか返さないので今はどちらの指標でも成り立つ
 * > (ブーストカウントは `calcBoostCount` が、段ボーナスは対象属性の消し数が +1 されるだけ)。
 * > +2 以上動かすぷよが増えたら、群の中を単独増分で並べる根拠が崩れるので作り直すこと。
 */
const bonusMetricOf = (
  explorationTarget: ExplorationTarget
): ((chains: Chain[]) => number) => {
  switch (explorationTarget.category) {
    case ExplorationCategory.Damage:
      // ダメージにはブーストカウントによる倍率が掛かる
      return (chains) => Simulator.calcTotalBoostCount(chains);
    case ExplorationCategory.SkillPuyoCount: {
      const countingBonus = explorationTarget.counting_bonus;
      if (countingBonus?.bonus_type !== CountingBonusType.Step) {
        return () => 0;
      }
      // 段ごとの加算ボーナスは対象属性の消し数の合計で段が決まる。
      // 同じ属性が2回入っていると1マスで段が+2動いて「ちょうど+1」の前提が崩れるので、
      // ここで重複を落としておく。
      const targetAttrs = [...new Set(countingBonus.target_attrs)];
      return (chains) =>
        targetAttrs.reduce(
          (m, attr) => m + Simulator.calcTotalCountOfTargetAttr(chains, attr),
          0
        );
    }
    default:
      // ぷよ使いカウントは完全に線形
      return () => 0;
  }
};

/** 優先度1つ分の順位。小さいほど良い。 */
const rankOf = (
  pref: PlusPreferenceKind,
  candidate: PlusAssignCandidate,
  color: ColoredPuyoAttr
): number => {
  switch (pref) {
    case PlusPreferenceKind.BiggerValue:
      // 値は大きいほど良いので符号を反転して順位にする
      return -candidate.gain;
    case PlusPreferenceKind.ColoredPuyo:
      return candidate.attr === color ? 0 : 1;
  }
};

/**
 * 良い順の比較を作る。
 *
 * まずなぞりで直接消えるぷよを後ろへ回す。通常なぞりでは消えるだけで連鎖に加わらず、
 * どの優先度で見ても増分は0なので、**優先度より下**ではなく優先度より先に落とす
 * (色を最優先にしたとき、なぞって消えるだけの同色ぷよが枠を食うのを防ぐ)。
 * そのうえで優先度を上から順に比べ、決着が付かなければ次へ送る。最後はマス番号で
 * 必ず決着させる (でないと上限で切る位置が実行ごとに変わってしまう)。
 */
const comparatorOf = (
  priorities: readonly PlusPreferenceKind[],
  color: ColoredPuyoAttr
) => {
  return (a: PlusAssignCandidate, b: PlusAssignCandidate): number => {
    const traced = Number(a.poppedByTrace) - Number(b.poppedByTrace);
    if (traced !== 0) {
      return traced;
    }
    for (const pref of priorities) {
      const diff = rankOf(pref, a, color) - rankOf(pref, b, color);
      if (diff !== 0) {
        return diff;
      }
    }
    return a.coord.index - b.coord.index;
  };
};

/**
 * プラス付与案を求める。
 *
 * 「値が大きい」より上に置かれた優先度は、候補マスを**段**に分ける。上の段から
 * 順に埋め、埋まり切らなかった段の中だけを値の最大化で決める。値が最優先なら
 * 段は1つ (全候補) なので、全体を値で最大化するのと同じことになる。
 *
 * @param simulationData 盤面
 * @param explorationTarget 探索対象
 * @param traceCoords 対象の消し方 (なぞり座標)
 * @param settings プラス付与案の設定 (数と優先度)
 * @returns 候補が1つも無ければ undefined
 */
export const calcPlusAssignPlan = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  traceCoords: PuyoCoord[],
  settings: PlusAssignSettings
): PlusAssignPlan | undefined => {
  const { num: maxPlusNum, color } = settings;

  if (!Number.isFinite(maxPlusNum) || maxPlusNum <= 0 || !traceCoords.length) {
    return undefined;
  }

  const priorities = normalizePlusPreferencePriorities(settings.priorities);
  const compare = comparatorOf(priorities, color);

  const bonusMetric = bonusMetricOf(explorationTarget);
  const baseChains = simulateTrace(simulationData, traceCoords);
  const baseValue = calcValueOfChains(baseChains, explorationTarget);
  const baseBonus = bonusMetric(baseChains);

  // なぞりで直接消えるぷよ。色変えモードではなぞったぷよも連鎖に参加し得るので
  // 「直接消える」のは通常なぞりのときだけ。
  const tracedSet =
    simulationData.traceMode === TraceMode.Normal
      ? new Set(traceCoords)
      : new Set<PuyoCoord>();

  const candidates: PlusAssignCandidate[] = [];

  for (let y = 0; y < PuyoCoord.YNum; y++) {
    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const puyo = simulationData.field[y][x];
      // プラスにできるのはフィールドの色ぷよだけ。既にプラスなら付ける余地がない。
      if (!puyo || !isColoredPuyoType(puyo.type) || isPlusPuyo(puyo.type)) {
        continue;
      }
      const coord = PuyoCoord.xyToCoord(x, y)!;
      const chains = simulateTrace(
        withPlusAt(simulationData, [coord]),
        traceCoords
      );

      candidates.push({
        coord,
        attr: getPuyoAttr(puyo.type) as ColoredPuyoAttr,
        gain: calcValueOfChains(chains, explorationTarget) - baseValue,
        affectsBonus: bonusMetric(chains) > baseBonus,
        poppedByTrace: tracedSet.has(coord)
      });
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  candidates.sort(compare);

  const num = Math.min(Math.trunc(maxPlusNum), candidates.length);

  // 「値が大きい」より上の優先度で段に分ける。段の順序は compare と同じなので、
  // ソート済みの並びをそのまま切っていけばよい。
  // normalize が必ず入れるので -1 にはならないが、万一無くても段を作らない側に倒す
  // (段が無ければ全候補が1つの段になり、値の最大化がそのまま効く)。
  const valueIndex = Math.max(
    priorities.indexOf(PlusPreferenceKind.BiggerValue),
    0
  );
  const tierPrefs = priorities.slice(0, valueIndex);
  // compare の先頭キーと同じ並びにしないと段が連続して並ばない。
  const tierKeyOf = (candidate: PlusAssignCandidate) =>
    [
      Number(candidate.poppedByTrace),
      ...tierPrefs.map((pref) => rankOf(pref, candidate, color))
    ].join(',');

  // 上の段から詰めていき、入り切らなかった段が「境界の段」になる。
  const forced: PlusAssignCandidate[] = [];
  const boundary: PlusAssignCandidate[] = [];
  let filled = 0;

  for (let i = 0; i < candidates.length && filled < num; ) {
    const key = tierKeyOf(candidates[i]);
    const tier: PlusAssignCandidate[] = [];
    while (i < candidates.length && tierKeyOf(candidates[i]) === key) {
      tier.push(candidates[i]);
      i++;
    }
    if (filled + tier.length <= num) {
      forced.push(...tier);
      filled += tier.length;
    } else {
      boundary.push(...tier);
      break;
    }
  }

  const pickNum = num - forced.length;
  const bonusGroup = boundary.filter((c) => c.affectsBonus);
  const plainGroup = boundary.filter((c) => !c.affectsBonus);

  // 非線形項への寄与数 j を固定すれば残りは線形なので、各群の上位から採るだけでよい。
  const jMin = Math.max(0, pickNum - plainGroup.length);
  const jMax = Math.min(pickNum, bonusGroup.length);

  let best: { chosen: PlusAssignCandidate[]; value: number } | undefined;

  for (let j = jMin; j <= jMax; j++) {
    const chosen = [
      ...forced,
      ...bonusGroup.slice(0, j),
      ...plainGroup.slice(0, pickNum - j)
    ];
    const chains = simulateTrace(
      withPlusAt(
        simulationData,
        chosen.map((c) => c.coord)
      ),
      traceCoords
    );
    const value = calcValueOfChains(chains, explorationTarget);
    if (!best || value > best.value) {
      best = { chosen, value };
    }
  }

  if (!best) {
    return undefined;
  }

  const chosen = best.chosen.sort(compare);

  return {
    coords: chosen.map((c) => c.coord),
    gains: chosen.map((c) => c.gain),
    baseValue,
    value: best.value,
    candidateNum: candidates.length
  };
};
