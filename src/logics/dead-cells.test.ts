import { describe, expect, it } from 'vitest';

import { createSimulationData } from '../store/internal/createSimulationData';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { TraceMode } from './TraceMode';
import { enumerateDeadCells, isDeadCellRuleApplicable } from './dead-cells';

/**
 * `rows` は上から順の盤面。`.` は空マス。ネクストは指定が無ければ空。
 * 8列6行に足りない分は空で埋める。
 */
const boardOf = (
  rows: string[],
  options: { next?: string; traceMode?: TraceMode; minimum?: number } = {}
) => {
  const typeOf = (c: string): PuyoType | undefined =>
    ({
      r: PuyoType.Red,
      w: PuyoType.Prism,
      k: PuyoType.Kata,
      '?': PuyoType.Question,
      b: PuyoType.Blue,
      g: PuyoType.Green,
      y: PuyoType.Yellow,
      p: PuyoType.Purple,
      h: PuyoType.Heart,
      o: PuyoType.Ojama,
      '.': undefined
    })[c];

  const field = [...new Array(PuyoCoord.YNum)].map((_, y) =>
    [...new Array(PuyoCoord.XNum)].map((_, x) => typeOf(rows[y]?.[x] ?? '.'))
  );
  const nextPuyos = [...new Array(PuyoCoord.XNum)].map((_, x) =>
    typeOf(options.next?.[x] ?? '.')
  );

  return createSimulationData(
    { field, nextPuyos },
    {
      minimumPuyoNumForPopping: options.minimum ?? 4,
      traceMode: options.traceMode ?? TraceMode.Normal
    }
  );
};

const deadCellsOf = (simulationData: ReturnType<typeof boardOf>) =>
  enumerateDeadCells(
    simulationData.field,
    simulationData.nextPuyos,
    simulationData.minimumPuyoNumForPopping,
    simulationData.traceMode
  );

const ruleApplies = (simulationData: ReturnType<typeof boardOf>) =>
  isDeadCellRuleApplicable(
    simulationData.field,
    simulationData.nextPuyos,
    simulationData.traceMode
  );

const cells = (simulationData: ReturnType<typeof boardOf>) =>
  deadCellsOf(simulationData)
    .map((coord) => `${coord.x},${coord.y}`)
    .sort();

describe('enumerateDeadCells', () => {
  it('marks a colour that cannot reach the popping count', () => {
    // 赤は列0に2個だけ。4個に届かないので両方とも消せない。
    const simulationData = boardOf(['r.......', 'r.......']);

    expect(cells(simulationData)).toEqual(['0,0', '0,1']);
  });

  it('leaves a colour alone once its run reaches the popping count', () => {
    const simulationData = boardOf([
      'r.......',
      'r.......',
      'r.......',
      'r.......'
    ]);

    expect(cells(simulationData)).toEqual([]);
  });

  it('counts a run across adjacent columns, not a fixed window', () => {
    // 列ごとの赤の数は 1,1,1,1。窓 (±1列) だと3個で「消せない」と誤判定するが、
    // ランは4列つながっているので合計4個で消え得る。
    const simulationData = boardOf(['rrrr....']);

    expect(cells(simulationData)).toEqual([]);
  });

  it('follows a run that snakes across columns (the window rule is wrong)', () => {
    // 列ごとの赤の数は 0,1,1,2。あるマスの横±1マスの窓で数えると2個にしかならず
    // 「消えない」と誤判定するが、ランは3列つながっているので合計4個で消え得る。
    const simulationData = boardOf(['.rrr....', '...r....']);

    expect(cells(simulationData)).toEqual([]);
  });

  it('splits runs at a column without that colour', () => {
    // 列2に赤が無いのでランが割れる。左は2個・右は2個で、どちらも4に届かない。
    const simulationData = boardOf(['rr.rr...']);

    expect(cells(simulationData)).toEqual(['0,0', '1,0', '3,0', '4,0']);
  });

  it('counts the next puyos into the column totals', () => {
    // 盤面の赤は3個だがネクストに1個あるので、ランの合計は4個になる。
    const simulationData = boardOf(['rrr.....'], { next: 'r.......' });

    expect(cells(simulationData)).toEqual([]);
  });

  it('follows the popping count setting', () => {
    const rows = ['rrr.....'];

    expect(cells(boardOf(rows, { minimum: 4 }))).toHaveLength(3);
    expect(cells(boardOf(rows, { minimum: 3 }))).toEqual([]);
  });

  it('ignores hearts and ojama (they only pop by being caught up)', () => {
    const simulationData = boardOf(['ho......']);

    expect(cells(simulationData)).toEqual([]);
  });

  it('judges each colour on its own', () => {
    // 赤は4個で消え得る。青は1個なので消せない。
    const simulationData = boardOf(['rrrr...b']);

    expect(cells(simulationData)).toEqual(['7,0']);
  });

  it('ignores prism and kata (they only pop by being caught up)', () => {
    const simulationData = boardOf(['wk......']);

    expect(cells(simulationData)).toEqual([]);
  });

  it('lets a next puyo bridge two runs (same as the rust rule)', () => {
    // 盤面の赤は列0に2個・列2に2個。列1には無いので本来ランは割れるが、
    // ネクストの赤が列1にあると列カウントが 2,1,2 になって1つのランに繋がる。
    // 落ちてこない列のネクストも数えるので、印を出し渋る方向へ倒れる。
    const simulationData = boardOf(['r.r.....', 'r.r.....'], {
      next: '.r......'
    });

    expect(cells(simulationData)).toEqual([]);
  });

  it('cannot judge a board with unknown puyos', () => {
    // ?ぷよは色が分からないので、どの色にも数えられない。数え落とすと
    // 消せるぷよに×が付くため、盤面ごと判定不可にする。
    const simulationData = boardOf(['rr?r....']);

    expect(deadCellsOf(simulationData)).toEqual([]);
    expect(ruleApplies(simulationData)).toBe(false);
  });

  it('cannot judge when an unknown puyo is in the next puyos', () => {
    const simulationData = boardOf(['rr......'], { next: '?.......' });

    expect(ruleApplies(simulationData)).toBe(false);
  });

  it('returns nothing in the paint trace modes', () => {
    // なぞりが任意のセルをその色に変えるので「列の個数は増えない」前提が崩れる。
    const simulationData = boardOf(['r.......'], {
      traceMode: TraceMode.ToRed
    });

    expect(deadCellsOf(simulationData)).toEqual([]);
    expect(ruleApplies(simulationData)).toBe(false);
  });

  it('applies in the normal trace mode', () => {
    expect(ruleApplies(boardOf(['r.......']))).toBe(true);
  });
});
