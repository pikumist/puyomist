import { describe, expect, it } from 'vitest';

import { createSimulationData } from '../store/internal/createSimulationData';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from './ExplorationTarget';
import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { TraceMode } from './TraceMode';
import {
  type PlusAssignSettings,
  PlusPreferenceKind,
  calcPlusAssignPlan,
  defaultPlusAssignSettings,
  normalizePlusPreferencePriorities,
  plusAssignSignatureOf
} from './plus-assign';
import { calcValueOfChains, simulateTrace } from './solution-value';

/**
 * `rows` は上から順の盤面。`.` は空マス。8列6行に足りない分は空で埋める。
 * 落下は縦方向にしか起きないので、宙に浮いた並びもそのまま書ける。
 */
const boardOf = (
  rows: string[],
  options: {
    boostArea?: PuyoCoord[];
    traceMode?: TraceMode;
  } = {}
): SimulationData => {
  const typeOf = (c: string): PuyoType | undefined =>
    ({
      r: PuyoType.Red,
      R: PuyoType.RedPlus,
      b: PuyoType.Blue,
      g: PuyoType.Green,
      y: PuyoType.Yellow,
      p: PuyoType.Purple,
      h: PuyoType.Heart,
      o: PuyoType.Ojama,
      w: PuyoType.Prism,
      '.': undefined
    })[c];

  const field = [...new Array(PuyoCoord.YNum)].map((_, y) =>
    [...new Array(PuyoCoord.XNum)].map((_, x) => typeOf(rows[y]?.[x] ?? '.'))
  );

  return createSimulationData(
    { field, nextPuyos: [...new Array(PuyoCoord.XNum)] },
    {
      minimumPuyoNumForPopping: 4,
      traceMode: options.traceMode ?? TraceMode.Normal,
      boostAreaCoordList: options.boostArea ?? []
    }
  );
};

const coord = (x: number, y: number) => PuyoCoord.xyToCoord(x, y)!;

/** 付与数だけ指定した既定の設定 */
const settingsOf = (
  num: number,
  overrides: Partial<PlusAssignSettings> = {}
): PlusAssignSettings => ({
  ...defaultPlusAssignSettings,
  num,
  ...overrides
});

const cellAddrs = (coords: PuyoCoord[]) => coords.map((c) => c.toCellAddr());

const puyotsukaiTarget: ExplorationTarget = {
  category: ExplorationCategory.PuyotsukaiCount,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 1
};

const damageTarget: ExplorationTarget = {
  category: ExplorationCategory.Damage,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 1,
  main_attr: PuyoAttr.Red
};

/**
 * 赤4個が落ちて消える盤面。
 * ハートをなぞるとおじゃまが落ち、それに続いて赤が下まで落ちてから消える。
 */
const fallingRedsBoard = (boostArea?: PuyoCoord[]) =>
  boardOf(
    ['r.......', 'r.......', 'r.......', 'ro......', '........', '.h......'],
    { boostArea }
  );

const heartTrace = [coord(1, 5)];

describe('calcPlusAssignPlan', () => {
  it('消えるぷよだけが候補に挙がり、値がその分だけ伸びる', () => {
    const data = fallingRedsBoard();
    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      heartTrace,
      settingsOf(2)
    )!;

    expect(plan.coords).toHaveLength(2);
    // ぷよ使いカウントでは、消える色ぷよ1個をプラスにすると +1
    expect(plan.gains).toEqual([1, 1]);
    expect(plan.value - plan.baseValue).toBe(2);
    // ハートとおじゃまは色ぷよではないので候補に入らない
    expect(plan.candidateNum).toBe(4);
  });

  it('ブーストエリアの判定は消える瞬間の位置で行う', () => {
    // ブーストエリアは最下段の1マスだけ。そこへ落ちてくるのは元 (0,3) の赤。
    const data = fallingRedsBoard([coord(0, 5)]);
    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      heartTrace,
      settingsOf(1)
    )!;

    expect(cellAddrs(plan.coords)).toEqual([coord(0, 3).toCellAddr()]);
    // エリア内のプラスは 2×3=6、通常は 3。差は +3。
    expect(plan.gains).toEqual([3]);
  });

  it('既にプラスのぷよと色ぷよ以外は候補に入らない', () => {
    const data = boardOf([
      'R.......',
      'r.......',
      'r.......',
      'ro......',
      '.w......',
      '.h......'
    ]);
    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      heartTrace,
      settingsOf(10)
    )!;

    // 赤4個のうち、既にプラスの1個を除いた3個だけ
    expect(plan.candidateNum).toBe(3);
    expect(plan.coords).toHaveLength(3);
  });

  it('上限に余りがあれば寄与0のマスも候補に入れる。なぞりで消えるぷよは最後。', () => {
    // 右下の青は落ちも消えもしない。緑はなぞりで直接消える。
    const data = boardOf([
      'r.......',
      'r.......',
      'r.......',
      'ro......',
      '.g......',
      '.hb.....'
    ]);
    const trace = [coord(1, 4), coord(1, 5)];
    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      trace,
      settingsOf(6)
    )!;

    expect(plan.gains).toEqual([1, 1, 1, 1, 0, 0]);
    // 寄与0どうしでは、なぞりで直接消える緑 (1,4) を後ろに回す
    expect(cellAddrs(plan.coords.slice(4))).toEqual([
      coord(2, 5).toCellAddr(),
      coord(1, 4).toCellAddr()
    ]);
  });

  it('上限が候補数を超えるときは出せるだけ出す', () => {
    const data = fallingRedsBoard();
    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      heartTrace,
      settingsOf(48)
    )!;

    expect(plan.coords).toHaveLength(4);
    expect(plan.candidateNum).toBe(4);
  });

  it('プラスを付けられるマスが無ければ案は無い', () => {
    const data = boardOf([
      '........',
      '........',
      '........',
      '........',
      'oo......',
      'oh......'
    ]);
    expect(
      calcPlusAssignPlan(data, puyotsukaiTarget, heartTrace, settingsOf(8))
    ).toBeUndefined();
  });

  it('なぞりが無ければ案は無い', () => {
    const data = fallingRedsBoard();
    expect(
      calcPlusAssignPlan(data, puyotsukaiTarget, [], settingsOf(8))
    ).toBeUndefined();
  });

  it('ダメージでブースト倍率が絡んでも総当たりと同じ組を選ぶ', () => {
    // ブーストエリアを部分的に置くと、ダメージは
    // (ブースト倍率) × (線形項) となり単純な貪欲では最適とは限らない。
    const data = boardOf(
      ['rb......', 'rb......', 'rb......', 'rbo.....', '........', '..h.....'],
      { boostArea: [coord(0, 5), coord(1, 5), coord(0, 4)] }
    );
    const trace = [coord(2, 5)];
    const num = 3;

    const plan = calcPlusAssignPlan(
      data,
      damageTarget,
      trace,
      settingsOf(num)
    )!;

    // 総当たり: 候補8マスから3マス選ぶ全56通り
    const candidates: PuyoCoord[] = [];
    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        if (data.field[y][x]) {
          const type = data.field[y][x]!.type;
          if (type === PuyoType.Red || type === PuyoType.Blue) {
            candidates.push(coord(x, y));
          }
        }
      }
    }
    expect(candidates).toHaveLength(8);

    const evaluate = (chosen: PuyoCoord[]) => {
      const field = data.field.map((row) => [...row]);
      for (const c of chosen) {
        const puyo = field[c.y][c.x]!;
        field[c.y][c.x] = {
          ...puyo,
          type:
            puyo.type === PuyoType.Red ? PuyoType.RedPlus : PuyoType.BluePlus
        };
      }
      return calcValueOfChains(
        simulateTrace({ ...data, field }, trace),
        damageTarget
      );
    };

    let bruteForce = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        for (let k = j + 1; k < candidates.length; k++) {
          bruteForce = Math.max(
            bruteForce,
            evaluate([candidates[i], candidates[j], candidates[k]])
          );
        }
      }
    }

    expect(plan.value).toBeCloseTo(bruteForce, 10);
    expect(plan.value).toBeGreaterThan(plan.baseValue);
  });

  it('スキル溜めでは対象属性のぷよだけが効き、段ボーナスも見る', () => {
    const data = boardOf([
      'rb......',
      'rb......',
      'rb......',
      'rbo.....',
      '........',
      '..h.....'
    ]);
    const trace = [coord(2, 5)];
    const target: ExplorationTarget = {
      category: ExplorationCategory.SkillPuyoCount,
      preference_priorities: [PreferenceKind.BiggerValue],
      optimal_solution_count: 1,
      main_attr: PuyoAttr.Red,
      counting_bonus: {
        bonus_type: CountingBonusType.Step,
        target_attrs: [PuyoAttr.Red],
        step_height: 5,
        bonus_count: 10,
        repeat: false
      }
    };

    const plan = calcPlusAssignPlan(data, target, trace, settingsOf(2))!;

    // 赤4個 (段ボーナス無し) が起点。赤にプラスを1個付けると数が5になって
    // 段ボーナス10が乗るので、単独の増分は 1+10=11 になる。
    // 増分はあくまで「そのマス単独」なので、2個付けても 4+2+10=16 で頭打ち。
    expect(plan.baseValue).toBe(4);
    expect(plan.gains).toEqual([11, 11]);
    expect(plan.value).toBe(16);
    // 青にプラスを付けても赤の数は増えないので、上位2件は赤のまま
    expect(cellAddrs(plan.coords).every((addr) => addr.startsWith('A'))).toBe(
      true
    );
  });

  it('段ボーナスの無いスキル溜めでは対象属性の数だけを見る', () => {
    const data = boardOf([
      'rb......',
      'rb......',
      'rb......',
      'rbo.....',
      '........',
      '..h.....'
    ]);
    const target: ExplorationTarget = {
      category: ExplorationCategory.SkillPuyoCount,
      preference_priorities: [PreferenceKind.BiggerValue],
      optimal_solution_count: 1,
      main_attr: PuyoAttr.Blue
    };

    const plan = calcPlusAssignPlan(
      data,
      target,
      [coord(2, 5)],
      settingsOf(2)
    )!;

    expect(plan.baseValue).toBe(4);
    expect(plan.gains).toEqual([1, 1]);
    expect(plan.value).toBe(6);
    // 青だけが効くので、上位2件は青の列 (B列) から採る
    expect(cellAddrs(plan.coords).every((addr) => addr.startsWith('B'))).toBe(
      true
    );
  });

  it('色変えモードではなぞったぷよも寄与し得る', () => {
    const data = boardOf(
      ['........', '........', 'r.......', 'r.......', 'r.......', 'b.......'],
      { traceMode: TraceMode.ToRed }
    );
    const trace = [coord(0, 5)];
    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      trace,
      settingsOf(4)
    )!;

    // なぞって赤に変わった (0,5) も消えるので、プラスの寄与がある
    expect(cellAddrs(plan.coords)).toContain(coord(0, 5).toCellAddr());
    expect(plan.gains.every((gain) => gain === 1)).toBe(true);
  });
});

describe('優先度', () => {
  /** 赤4個が消え、青2個は消えない盤面 */
  const redsAndBlues = () =>
    boardOf([
      'r.......',
      'r.......',
      'r.......',
      'ro......',
      '.b......',
      '.hb.....'
    ]);

  it('値が最優先なら、色より値の大きいマスを採る', () => {
    const plan = calcPlusAssignPlan(
      redsAndBlues(),
      puyotsukaiTarget,
      heartTrace,
      settingsOf(2, {
        priorities: [
          PlusPreferenceKind.BiggerValue,
          PlusPreferenceKind.ColoredPuyo
        ],
        color: PuyoAttr.Blue
      })
    )!;

    expect(plan.gains).toEqual([1, 1]);
    expect(plan.value - plan.baseValue).toBe(2);
    // 採ったのは消える赤。青は値で負ける
    expect(cellAddrs(plan.coords)).toEqual([
      coord(0, 0).toCellAddr(),
      coord(0, 1).toCellAddr()
    ]);
  });

  it('色ぷよが最優先なら、値が下がってもその色から埋める', () => {
    const plan = calcPlusAssignPlan(
      redsAndBlues(),
      puyotsukaiTarget,
      heartTrace,
      settingsOf(2, {
        priorities: [
          PlusPreferenceKind.ColoredPuyo,
          PlusPreferenceKind.BiggerValue
        ],
        color: PuyoAttr.Blue
      })
    )!;

    expect(cellAddrs(plan.coords)).toEqual([
      coord(1, 4).toCellAddr(),
      coord(2, 5).toCellAddr()
    ]);
    // 青は消えないので値は伸びない
    expect(plan.gains).toEqual([0, 0]);
    expect(plan.value).toBe(plan.baseValue);
  });

  it('色ぷよが最優先でも、その色を使い切ったら次は値で決める', () => {
    const plan = calcPlusAssignPlan(
      redsAndBlues(),
      puyotsukaiTarget,
      heartTrace,
      settingsOf(3, {
        priorities: [
          PlusPreferenceKind.ColoredPuyo,
          PlusPreferenceKind.BiggerValue
        ],
        color: PuyoAttr.Blue
      })
    )!;

    expect(plan.coords).toHaveLength(3);
    // 青2個が先に埋まり、残り1枠は値の大きい赤
    expect(cellAddrs(plan.coords.slice(0, 2))).toEqual([
      coord(1, 4).toCellAddr(),
      coord(2, 5).toCellAddr()
    ]);
    expect(plan.gains).toEqual([0, 0, 1]);
    expect(plan.value - plan.baseValue).toBe(1);
  });

  it('色ぷよが最優先でも、なぞりで直接消えるぷよは枠を食わない', () => {
    // なぞる緑と、消えない緑を置く。緑を最優先にしても、なぞりで消える方は後回し。
    const data = boardOf([
      'r.......',
      'r.......',
      'r.......',
      'ro......',
      '.g......',
      '.hg.....'
    ]);
    const trace = [coord(1, 4), coord(1, 5)];

    const plan = calcPlusAssignPlan(
      data,
      puyotsukaiTarget,
      trace,
      settingsOf(2, {
        priorities: [
          PlusPreferenceKind.ColoredPuyo,
          PlusPreferenceKind.BiggerValue
        ],
        color: PuyoAttr.Green
      })
    )!;

    // 1つ目は消えない緑。2つ目はなぞりで消える緑ではなく、値のある赤。
    expect(cellAddrs(plan.coords)).toEqual([
      coord(2, 5).toCellAddr(),
      coord(0, 0).toCellAddr()
    ]);
    expect(plan.gains).toEqual([0, 1]);
  });
});

describe('normalizePlusPreferencePriorities', () => {
  it('欠け・重複・未知の種類を直す', () => {
    expect(normalizePlusPreferencePriorities([])).toEqual([
      PlusPreferenceKind.BiggerValue,
      PlusPreferenceKind.ColoredPuyo
    ]);
    expect(
      normalizePlusPreferencePriorities([PlusPreferenceKind.ColoredPuyo])
    ).toEqual([PlusPreferenceKind.ColoredPuyo, PlusPreferenceKind.BiggerValue]);
    expect(
      normalizePlusPreferencePriorities([
        PlusPreferenceKind.ColoredPuyo,
        PlusPreferenceKind.ColoredPuyo,
        99 as PlusPreferenceKind
      ])
    ).toEqual([PlusPreferenceKind.ColoredPuyo, PlusPreferenceKind.BiggerValue]);
    expect(normalizePlusPreferencePriorities(undefined)).toEqual([
      PlusPreferenceKind.BiggerValue,
      PlusPreferenceKind.ColoredPuyo
    ]);
  });
});

describe('plusAssignSignatureOf', () => {
  it('入力が同じなら同じ指紋になる', () => {
    const data = fallingRedsBoard();
    expect(
      plusAssignSignatureOf(data, puyotsukaiTarget, heartTrace, settingsOf(8))
    ).toEqual(
      plusAssignSignatureOf(data, puyotsukaiTarget, heartTrace, settingsOf(8))
    );
  });

  it('付与数・なぞり・探索対象・盤面のどれが変わっても指紋が変わる', () => {
    const data = fallingRedsBoard();
    const base = plusAssignSignatureOf(
      data,
      puyotsukaiTarget,
      heartTrace,
      settingsOf(8)
    );

    expect(
      plusAssignSignatureOf(data, puyotsukaiTarget, heartTrace, settingsOf(9))
    ).not.toEqual(base);
    expect(
      plusAssignSignatureOf(
        data,
        puyotsukaiTarget,
        [coord(0, 5)],
        settingsOf(8)
      )
    ).not.toEqual(base);
    expect(
      plusAssignSignatureOf(data, damageTarget, heartTrace, settingsOf(8))
    ).not.toEqual(base);
    expect(
      plusAssignSignatureOf(
        fallingRedsBoard([coord(1, 5), coord(0, 5)]),
        puyotsukaiTarget,
        heartTrace,
        settingsOf(8)
      )
    ).not.toEqual(base);
  });
});
