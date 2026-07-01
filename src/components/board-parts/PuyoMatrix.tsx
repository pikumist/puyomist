import React from 'react';
import type { PoppingPuyo } from '../../store/selectors';
import type { Puyo } from '../../logics/Puyo';
import type { PuyoType } from '../../logics/PuyoType';
import HybridPuyo from './HybridPuyo';

interface PuyoMatrixProps {
  nextPuyos: (Puyo | undefined)[];
  field: (Puyo | undefined)[][];
  /** 消えかけのぷよ(前ステップ位置のゴースト)。フェード演出に使う。 */
  poppingPuyos?: PoppingPuyo[];
}

interface RenderItem {
  id: number;
  x: number;
  y: number;
  type: PuyoType;
  popping: boolean;
}

function* enumerateField(
  nextPuyos: (Puyo | undefined)[],
  field: (Puyo | undefined)[][]
) {
  for (const [j, puyo] of nextPuyos.entries()) {
    yield {
      x: j,
      y: -1,
      puyo
    };
  }
  for (const [i, row] of field.entries()) {
    for (const [j, puyo] of row.entries()) {
      yield {
        x: j,
        y: i,
        puyo
      };
    }
  }
}

/** 全てのぷよの描画 */
const PuyoMatrix: React.FC<PuyoMatrixProps> = React.memo((props) => {
  const { nextPuyos, field, poppingPuyos } = props;

  // ぷよは id でソートした安定順で描画する。グリッド位置順で並べると、落下で
  // 位置が変わるたびに子要素の並びが変わり、React が DOM ノードを差し替え
  // (再挿入)してしまい CSS transition が途切れる。id 順なら並びが不変になり、
  // 移動時は各ぷよの transform だけが変化してアニメーションが効く。空セルは
  // 何も描画しないので除外する。
  const items: RenderItem[] = [];
  for (const { x, y, puyo } of enumerateField(nextPuyos, field)) {
    if (Number.isInteger(puyo?.id)) {
      items.push({ id: puyo!.id, x, y, type: puyo!.type, popping: false });
    }
  }
  // 消えかけのぷよは前ステップの位置にゴーストとして残し、フェードで消す。
  // 直前は同じ id で通常描画されているので、同じ DOM 要素が再利用され transition
  // が走る。消滅ぷよは現ステップの field には居ないので id は衝突しない。
  for (const p of poppingPuyos ?? []) {
    items.push({ id: p.id, x: p.x, y: p.y, type: p.type, popping: true });
  }
  items.sort((a, b) => a.id - b.id);

  return (
    <g>
      {items.map(({ id, x, y, type, popping }) => (
        <HybridPuyo key={id} type={type} x={x} y={y} popping={popping} />
      ))}
    </g>
  );
});

export default PuyoMatrix;
