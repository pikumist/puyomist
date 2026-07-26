import type { PuyoType } from '@/logics/PuyoType';
import {
  type PaintSearchResult,
  boardSignatureOf,
  paintSearchSignatureOf
} from '@/logics/paint-search';
import type { PuyoAppState } from './types';

/** 消えかけ(ポップ演出中)のぷよ1つ分。前ステップの位置で描画する。 */
export interface PoppingPuyo {
  id: number;
  x: number;
  y: number;
  type: PuyoType;
}

/** ステートからアクティブなアニメーションステップを選択する */
export const selectActiveAnimationStep = (state: PuyoAppState) => {
  const { animationSteps, activeAnimationStepIndex } = state;

  if (
    animationSteps.length > 0 &&
    activeAnimationStepIndex >= 0 &&
    activeAnimationStepIndex <= animationSteps.length - 1
  ) {
    return animationSteps[activeAnimationStepIndex];
  }
};

/** ステートからアクティブな連鎖リストを選択する */
export const selectActiveChains = (state: PuyoAppState) => {
  const step = selectActiveAnimationStep(state);
  return step?.chains;
};

/** ステートからアクティブなフィールドとネクストぷよを選択する */
export const selectActiveFieldAndNextPuyos = (state: PuyoAppState) => {
  const step = selectActiveAnimationStep(state);

  if (step) {
    return {
      field: step.field,
      nextPuyos: step.nextPuyos
    };
  }

  const { simulationData } = state;

  return {
    field: simulationData.field,
    nextPuyos: simulationData.nextPuyos
  };
};

/**
 * アクティブなステップで「消えた」ぷよを前ステップの位置つきで返す。
 * 前ステップに居て現ステップに居ない id を消滅とみなす(落下やネクスト取り込みは
 * id が保持されるので除外される)。ポップのフェード演出用のゴーストとして描画する。
 */
export const selectActivePoppingPuyos = (state: PuyoAppState): PoppingPuyo[] => {
  const { animationSteps, activeAnimationStepIndex } = state;
  const cur = animationSteps[activeAnimationStepIndex];
  const prev = animationSteps[activeAnimationStepIndex - 1];

  if (!cur || !prev) {
    return [];
  }

  const survivingIds = new Set<number>();
  for (const row of cur.field) {
    for (const puyo of row) {
      if (puyo) {
        survivingIds.add(puyo.id);
      }
    }
  }
  for (const puyo of cur.nextPuyos) {
    if (puyo) {
      survivingIds.add(puyo.id);
    }
  }

  const popping: PoppingPuyo[] = [];
  for (const [y, row] of prev.field.entries()) {
    for (const [x, puyo] of row.entries()) {
      if (puyo && !survivingIds.has(puyo.id)) {
        popping.push({ id: puyo.id, x, y, type: puyo.type });
      }
    }
  }
  return popping;
};

/**
 * まだ有効なぷよ塗り探索の結果を選ぶ。
 *
 * 結果を出したあとに盤面・ルール・探索対象・塗り設定のどれかが変わっていたら、
 * その結果は別の入力に対する答えなので無かったことにする。古い座標を今の盤面に
 * 適用してしまうのを、表示の段階で断つ。
 */
export const selectPaintSearchResult = (
  state: PuyoAppState
): PaintSearchResult | undefined => {
  const result = state.paintSearchResult;
  if (!result) {
    return undefined;
  }
  const signature = paintSearchSignatureOf(
    state.simulationData,
    state.explorationTarget,
    state.paintSearchSettings
  );
  return result.signature === signature ? result : undefined;
};

/**
 * 塗りの取り消しが今も意味を持つかどうか。
 *
 * 塗ったあとに盤面が別経路で変わっていたら、戻すとその変更まで巻き戻るので
 * 取り消しは提示しない。
 */
export const selectPaintUndoAvailable = (state: PuyoAppState): boolean => {
  const undo = state.paintUndo;
  return Boolean(
    undo && undo.boardSignature === boardSignatureOf(state.simulationData)
  );
};
