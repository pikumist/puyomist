import type { Puyo } from './Puyo';
import {
  PuyoAttr,
  type ColoredPuyoAttr,
  coloredPuyoAttrList
} from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { getPuyoAttr } from './PuyoType';
import { TraceMode } from './TraceMode';

/**
 * @module ひっつき消しできない色ぷよの判定
 *
 * 落下は縦方向のみでぷよの列は不変なので、隣接し得るのは列差1以内のぷよ同士に限られる。
 * よって連結成分は「その色が1個以上ある列の連続区間 (ラン)」の中にしか収まらず、
 *
 * > ランに含まれるその色の総数が最低消し数未満なら、そのラン内のぷよは絶対にひっつかない
 *
 * が厳密に成り立つ。詳細と実測 (1盤面あたり平均7.02個・99.9%の盤面に1個以上) は
 * `docs/research/paint-search.md` §4 を参照。Rust 側の `paint.rs` の `dead_cells` と同じ規則で、
 * 表示のたびに wasm を呼ぶほどのものではないのでこちらにも実装してある。
 *
 * **「消えない」ではなく「ひっつかない」**。通常なぞりモードではなぞったぷよは連結数に
 * 関係なく消える (`Simulator.popTracingPuyos`) ので、ここで挙がるぷよもなぞれば消える。
 * 消えないのは「ひっつき消し (＝連鎖やダメージになる消え方)」の方。
 *
 * **「あるマスを中心とした横±1マスの窓」で判定するのは誤り**。連結成分は列をまたいで
 * 数珠つなぎに伸びられるため、列ごとの個数が 0,1,1,2 のとき窓の合計は2でもランは4になる。
 */

type Field = (Puyo | undefined)[][];
type NextPuyos = (Puyo | undefined)[];

/**
 * 判定が成り立つ盤面・設定かどうか。
 *
 * `docs/research/paint-search.md` §4 の「厳密なのは限定条件下だけ」に対応する。
 * 実際のゲームの補充で偽になり得る点は文言側で断る。
 */
export const isDeadCellRuleApplicable = (
  field: Field,
  nextPuyos: NextPuyos,
  traceMode: TraceMode
): boolean => {
  // なぞり塗りモードでは、なぞりが任意のセルをその色に変えるので列ごとの個数が増える。
  // 「列の個数は増えない」という前提が崩れる。
  if (traceMode !== TraceMode.Normal) {
    return false;
  }

  // ?ぷよ (スクリーンショット認識に失敗したマス) は色が分からない。どの色にも数えない
  // ままだと、その色の個数が過小になったりランが割れたりして、消せるぷよに×が付く。
  return !hasQuestion(field) && !hasQuestion([nextPuyos]);
};

const hasQuestion = (rows: (Puyo | undefined)[][]): boolean =>
  rows.some((row) =>
    row.some((puyo) => puyo && getPuyoAttr(puyo.type) === PuyoAttr.Question)
  );

/** 色ごとに、列にその色がいくつあるか数える (ネクストも含める)。 */
const countByColumn = (
  field: Field,
  nextPuyos: NextPuyos,
  attr: ColoredPuyoAttr
): number[] => {
  const counts = [...new Array(PuyoCoord.XNum)].map(() => 0);

  for (const row of field) {
    for (const [x, puyo] of row.entries()) {
      if (puyo && getPuyoAttr(puyo.type) === attr) {
        counts[x]++;
      }
    }
  }
  // ネクストも列の個数に数える (Rust の `ColumnRuns` と同じ)。落ちてこない列の
  // ネクストまで数えるので、ランが繋がる方向 = 印を出し渋る方向に倒れる。
  for (const [x, puyo] of nextPuyos.entries()) {
    if (puyo && getPuyoAttr(puyo.type) === attr) {
      counts[x]++;
    }
  }

  return counts;
};

/** 列 `x` が属するラン (その色が途切れずに並ぶ列の連続区間) の総数。 */
const runTotalAt = (counts: number[], x: number): number => {
  if (counts[x] === 0) {
    return 0;
  }

  let start = x;
  while (start > 0 && counts[start - 1] > 0) {
    start--;
  }
  let end = x;
  while (end + 1 < counts.length && counts[end + 1] > 0) {
    end++;
  }

  let total = 0;
  for (let i = start; i <= end; i++) {
    total += counts[i];
  }
  return total;
};

/**
 * ひっつき消しが絶対に起こせない色ぷよの座標を列挙する。
 *
 * ハート・おじゃま・固ぷよ・プリズムは単独では消えず巻き込みで消えるので対象外
 * (色ぷよだけ見る)。判定が成り立たない条件では空を返す。
 *
 * 盤面は**画面に出ているもの**を渡すこと。連鎖アニメーション中は
 * `selectActiveFieldAndNextPuyos` が返すコマの盤面を渡せば、表示と判定が食い違わない。
 */
export const enumerateDeadCells = (
  field: Field,
  nextPuyos: NextPuyos,
  minimumPuyoNumForPopping: number,
  traceMode: TraceMode
): PuyoCoord[] => {
  if (!isDeadCellRuleApplicable(field, nextPuyos, traceMode)) {
    return [];
  }

  const countsByAttr = new Map<ColoredPuyoAttr, number[]>(
    coloredPuyoAttrList.map((attr) => [
      attr,
      countByColumn(field, nextPuyos, attr)
    ])
  );

  const coords: PuyoCoord[] = [];

  for (const [y, row] of field.entries()) {
    for (const [x, puyo] of row.entries()) {
      if (!puyo) {
        continue;
      }
      const counts = countsByAttr.get(
        getPuyoAttr(puyo.type) as ColoredPuyoAttr
      );
      if (!counts) {
        continue;
      }
      if (runTotalAt(counts, x) < minimumPuyoNumForPopping) {
        coords.push(PuyoCoord.xyToCoord(x, y)!);
      }
    }
  }

  return coords;
};
