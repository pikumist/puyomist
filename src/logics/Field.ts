import type { Board } from './Board';
import { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';
import { TraceMode } from './TraceMode';
import { createfilledOneBitFieldBeforeIndex } from './bit-field';
import {
  type ChainDamage,
  type DamageTerm,
  calcChainFactor,
  calcDamageTerm,
  calcPoppingFactor
} from './damage';
import { choice, shuffle } from './generics/random';
import { sleep } from './generics/sleep';
import {
  type ColoredPuyoAttribute,
  PuyoAttribute,
  PuyoType,
  convertPuyoType,
  getPuyoAttribute,
  isColoredPuyoAttribute,
  isColoredPuyoType,
  isPlusPuyo
} from './puyo';
import {
  type SolutionCarry,
  type SolutionResult,
  SolutionState,
  type SolvedResult,
  type TotalDamages
} from './solution';

/**
 * フィールドは、インフィールドとネクストぷよで構成される。
 *
 * インフィールドは 8x6 のぷよが入るセル行列からなる。
 * | 位置 | セルインデックス | XY座標 |
 * | -- | -- | -- |
 * | 左上 | 0 | {x: 0, y: 0} |
 * | 右上 | 7 | {x: 7, y: 0} |
 * | 左下 | 40 | {x: 0, y: 8} |
 * | 右下 | 47 | {x: 7, y: 8} |
 *
 * ネクストぷよは 8つのぷよからなる。(実際は無限に上に連なっているはずだが割愛)
 */
export class Field {
  public static readonly colorAttrs: ReadonlyArray<PuyoAttribute> = [
    PuyoAttribute.Red,
    PuyoAttribute.Blue,
    PuyoAttribute.Green,
    PuyoAttribute.Yellow,
    PuyoAttribute.Purple
  ];
  public static readonly specialAttrs: ReadonlyArray<PuyoAttribute> = [
    PuyoAttribute.Heart,
    PuyoAttribute.Prism,
    PuyoAttribute.Ojyama,
    PuyoAttribute.Kata
  ];

  private static readonly defaultMinimumPuyoNumForPopping = 4;
  private static readonly defaultMaxTraceNum = 5;
  private static readonly defaultAnimationDuration = 200;

  private static totalCountOfdetectPopBlocks = 0;
  private static totalTimeOfdetectPopBlocks = 0;

  private readonly cellMatrix: (PuyoType | undefined)[][];
  private nextPuyos: (PuyoType | undefined)[];
  private boostAreaCoordSetList: ReadonlySet<PuyoCoord>[] = [];
  private isChanceMode = false;
  private traceCoords: PuyoCoord[] = [];
  private minimumPuyoNumForPopping = Field.defaultMinimumPuyoNumForPopping;
  private maxTraceNum = Field.defaultMaxTraceNum;
  private traceMode = TraceMode.Normal;
  private poppingLeverage = 1.0;
  private chainLeverage = 1.0;
  private chainAnimating = false;
  private animationDuration = Field.defaultAnimationDuration;
  private currentChainNum = 0;
  private chainDamages: ChainDamage[] = [];

  /**
   * フィールドの指定があればそれをコピーする。そうでなければ初期化する。
   * @param field
   */
  constructor(field?: Field) {
    if (field) {
      this.cellMatrix = field.cellMatrix.map((row) => [...row]);
      this.nextPuyos = [...field.nextPuyos];
      this.boostAreaCoordSetList = [...field.boostAreaCoordSetList];
      this.isChanceMode = field.isChanceMode;
      this.traceCoords = [...field.traceCoords];
      this.minimumPuyoNumForPopping = field.minimumPuyoNumForPopping;
      this.maxTraceNum = field.maxTraceNum;
      this.traceMode = field.traceMode;
      this.poppingLeverage = field.poppingLeverage;
      this.chainLeverage = field.chainLeverage;
      this.chainAnimating = field.chainAnimating;
      this.animationDuration = field.animationDuration;
      this.currentChainNum = field.currentChainNum;
      this.chainDamages = [...field.chainDamages];
    } else {
      this.cellMatrix = [...new Array(PuyoCoord.YNum)].map(
        () => new Array(PuyoCoord.XNum)
      );
      this.nextPuyos = new Array<PuyoType | undefined>(PuyoCoord.XNum);
      this.clear();
    }
  }

  /** ぷよが消えるのに必要な個数をセットする。 */
  public setMinimumPuyoNumForPopping(num: number): void {
    this.minimumPuyoNumForPopping = num;
  }

  /** ぷよが消えるのに必要な個数を取得する。 */
  public getMinimumPuyoNumForPopping(): number {
    return this.minimumPuyoNumForPopping;
  }

  /** 最大なぞり消し数をセットする。 */
  public setMaxTraceNum(traceNum: number): void {
    this.maxTraceNum = traceNum;
  }

  /** 最大なぞり消し数を取得する。 */
  public getMaxTraceNum(): number {
    return this.maxTraceNum;
  }

  /** 実質の最大なぞり消し数を取得する。チャンスモード中は5に制限される。 */
  public getActualMaxTraceNum(): number {
    return this.isChanceMode ? 5 : this.maxTraceNum;
  }

  /** なぞり消しモードをセットする。 */
  public setTraceMode(traceMode: TraceMode): void {
    this.traceMode = traceMode;
  }

  /** なぞり消しモードを取得する。 */
  public getTraceMode(): TraceMode {
    return this.traceMode;
  }

  /** なぞり消し倍率をセットする。 */
  public setPoppingLeverage(leverage: number): void {
    this.poppingLeverage = leverage;
  }

  /** なぞり消し倍率を取得する。 */
  public getPoppingLeverage(): number {
    return this.poppingLeverage;
  }

  /** 連鎖倍率をセットする。 */
  public setChainLeverage(leverage: number): void {
    this.chainLeverage = leverage;
  }

  /** 連鎖倍率を取得する。 */
  public getChainLeverage(): number {
    return this.chainLeverage;
  }

  /** アニメーション間隔 (ms) をセットする。 */
  public setAnimationDuration(duration: number): void {
    this.animationDuration = duration;
  }

  /** アニメーション間隔 (ms) を取得する。 */
  public getAnimationDuration(): number {
    return this.animationDuration;
  }

  /** フィールドの中にあるぷよ行列を取得する。 */
  public getCellMatrix(): (PuyoType | undefined)[][] {
    return this.cellMatrix;
  }

  /** ネクストぷよ配列を取得する。 */
  public getNextPuyos(): (PuyoType | undefined)[] {
    return this.nextPuyos;
  }

  /** ブーストエリアの座標セットリストを取得する。 */
  public getBoostAreaCoordSetList(): ReadonlySet<PuyoCoord>[] {
    return this.boostAreaCoordSetList;
  }

  /** ブーストエリアの座標セットリストをセットする。 */
  public setBoostAreaCoordSetList(
    boostAreaCoordSetList: ReadonlySet<PuyoCoord>[]
  ): void {
    this.boostAreaCoordSetList = boostAreaCoordSetList;
  }

  /** 連鎖アニメーション中かどうか。 */
  public isChainAnimating(): boolean {
    return this.chainAnimating;
  }

  /** 現在なぞり中の数を取得する。 */
  public getCurrentTracingNum() {
    return this.traceCoords.length;
  }

  /** 現在のなぞり座標リストを取得する */
  public getCurrentTracingCoords() {
    return this.traceCoords;
  }

  /** 全連鎖ダメージ情報を取得する */
  public getChainDamages() {
    return this.chainDamages;
  }

  /** フィールドをクリアする。 */
  public clear(): void {
    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        this.cellMatrix[y][x] = undefined;
      }
    }
    for (let i = 0; i < PuyoCoord.XNum; i++) {
      this.nextPuyos[i] = undefined;
    }

    this.isChanceMode = false;
    this.maxTraceNum = Field.defaultMaxTraceNum;
    this.chainAnimating = false;
    this.animationDuration = Field.defaultAnimationDuration;
    this.currentChainNum = 0;
  }

  public clone(): Field {
    return new Field(this);
  }

  /*
   * ネクストぷよをランダムにリセットする。
   */
  public resetNextPuyosAsRandom(): void {
    const possibleNextPuyoTypes = [
      PuyoType.Red,
      PuyoType.Blue,
      PuyoType.Green,
      PuyoType.Yellow,
      PuyoType.Purple
    ];

    for (let x = 0; x < PuyoCoord.XNum; x++) {
      this.nextPuyos[x] = choice(possibleNextPuyoTypes);
    }
  }

  /**
   * ネクストぷよを同種のぷよでリセットする。
   * @param type ぷよの種類
   */
  public resetNextPuyosAsSameType(type: PuyoType): void {
    for (let x = 0; x < PuyoCoord.XNum; x++) {
      this.nextPuyos[x] = type;
    }
  }

  /**
   * 連鎖の種やとくべつルールなど固定のボードからフィールドをリセットする
   * @param board 連鎖の種やとくべつルールなど固定のボード
   */
  public resetFieldByBoard(board: Board): void {
    this.chainAnimating = false;
    this.currentChainNum = 0;

    this.isChanceMode = Boolean(board.isChanceMode);
    if (board.traceMode !== undefined) {
      this.traceMode = board.traceMode;
    }
    if (board.minimumPuyoNumForPopping !== undefined) {
      this.minimumPuyoNumForPopping = board.minimumPuyoNumForPopping;
    }
    if (board.chainLeverage !== undefined) {
      this.chainLeverage = board.chainLeverage;
    }

    if (board.nextPuyos) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        this.nextPuyos[x] = board.nextPuyos[x];
      }
    }

    const matrix = board.matrix;

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        this.cellMatrix[y][x] = matrix[y][x];
      }
    }
  }

  /*
   * ランダムにフィールドをリセットする。
   */
  public randomResetField(): void {
    this.clear();

    const possibleTypes = [
      PuyoType.Red,
      PuyoType.Blue,
      PuyoType.Green,
      PuyoType.Yellow,
      PuyoType.Purple,
      PuyoType.Heart,
      PuyoType.Prism,
      PuyoType.Ojyama,
      PuyoType.Kata
    ];

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const candidateTypes = [...possibleTypes];
        shuffle(candidateTypes);

        let ok = false;

        for (let i = 0; i < candidateTypes.length; i++) {
          const type = candidateTypes[i];

          this.cellMatrix[y][x] = type;

          if (this.detectPopBlocks2().length === 0) {
            ok = true;
            break;
          }

          this.cellMatrix[y][x] = undefined;
        }

        if (!ok) {
          throw new Error('Failed to create random field.');
        }
      }
    }
  }

  /**
   * なぞり中のぷよを追加する。
   * TODO: checkIfAddableCoord の様なロジックを加える。
   */
  public addTracingPuyo(puyoCoord: PuyoCoord | undefined) {
    if (!puyoCoord) {
      return;
    }

    if (this.getCurrentTracingNum() >= this.maxTraceNum) {
      return;
    }

    const puyoType = this.cellMatrix[puyoCoord.y][puyoCoord.x];
    if (!puyoType) {
      return;
    }

    if (
      !this.traceCoords.some((c) => c.x === puyoCoord.x && c.y === puyoCoord.y)
    ) {
      this.traceCoords.push(puyoCoord);
    }
  }

  /** なぞり中のぷよを一気にセットする。最適解探索時にのみ使う。 */
  public setTraceCoords(puyoCoords: PuyoCoord[]) {
    this.traceCoords = puyoCoords;
  }

  /** なぞり中のぷよ座標リストをクリアする。 */
  public clearTraceCoords() {
    this.traceCoords = [];
  }

  public solve2(
    optimizationTarget: OptimizationTarget
  ): SolvedResult | undefined {
    Field.totalCountOfdetectPopBlocks = 0;
    Field.totalTimeOfdetectPopBlocks = 0;

    const startTime = Date.now();

    const originalField = new Field(this);

    const carry: SolutionCarry = {
      solutionNums: 0,
      optimalSolution: undefined
    };

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const coord = PuyoCoord.xyToCoord(x, y)!;
        const state = new SolutionState(
          createfilledOneBitFieldBeforeIndex(coord.index),
          new Map()
        );
        Field.advanceTrace(
          originalField,
          optimizationTarget,
          state,
          carry,
          coord
        );
      }
    }

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    console.log(
      'total count of detectPopBlocks',
      Field.totalCountOfdetectPopBlocks
    );
    console.log(
      'total time of detectPopBlocks',
      Field.totalTimeOfdetectPopBlocks
    );

    return {
      optimizationTarget,
      elapsedTime,
      candidatesNum: carry.solutionNums,
      optimalSolution: carry.optimalSolution
    };
  }

  public solve3(
    optimizationTarget: OptimizationTarget,
    index: number
  ): SolvedResult | undefined {
    Field.totalCountOfdetectPopBlocks = 0;
    Field.totalTimeOfdetectPopBlocks = 0;

    const startTime = Date.now();

    const originalField = new Field(this);

    const carry: SolutionCarry = {
      solutionNums: 0,
      optimalSolution: undefined
    };

    const state = new SolutionState(
      createfilledOneBitFieldBeforeIndex(index),
      new Map()
    );
    const coord = PuyoCoord.indexToCoord(index)!;

    Field.advanceTrace(originalField, optimizationTarget, state, carry, coord);

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    console.log(
      'total count of detectPopBlocks',
      Field.totalCountOfdetectPopBlocks
    );
    console.log(
      'total time of detectPopBlocks',
      Field.totalTimeOfdetectPopBlocks
    );

    return {
      optimizationTarget,
      elapsedTime,
      candidatesNum: carry.solutionNums,
      optimalSolution: carry.optimalSolution
    };
  }

  /**
   * フィールドに対してなぞり消しを行って結果を求める。
   * @param originalField
   * @param traceCoords
   * @returns
   */
  private static calcSolutionResult(
    originalField: Field,
    traceCoords: PuyoCoord[]
  ): SolutionResult {
    const field = new Field(originalField);
    field.setTraceCoords(traceCoords);
    field.continueChainsToTheEnd();

    const puyoTsukaiCount = Field.calcTotalPuyoTsukaiCount(field.chainDamages);

    const totalDamages: Partial<TotalDamages> = Object.fromEntries(
      Field.colorAttrs.map((targetAttr) => {
        return [
          targetAttr,
          Field.calcTotalDamageOfTargetAttr(field.chainDamages, targetAttr)
        ];
      })
    );
    totalDamages.total = Object.keys(totalDamages).reduce((m, attr) => {
      return m + totalDamages[attr as '1']!;
    }, 0);

    return {
      traceCoords,
      puyoTsukaiCount,
      totalDamages: totalDamages as TotalDamages,
      chainDamages: field.chainDamages
    };
  }

  private static updateCarry(
    carry: SolutionCarry,
    optTarget: OptimizationTarget,
    solutionResult: SolutionResult
  ): void {
    carry.solutionNums++;

    if (!carry.optimalSolution) {
      carry.optimalSolution = solutionResult;
      return;
    }

    carry.optimalSolution = Field.betterSolution(
      optTarget,
      carry.optimalSolution,
      solutionResult
    );
  }

  /**
   * s1 と s2 とで良い解法の方を返す。優劣付けれらない場合は s1 を返す。
   * @param s1
   * @param s2
   * @returns
   */
  public static betterSolution(
    optTarget: OptimizationTarget,
    s1: SolutionResult,
    s2: SolutionResult
  ): SolutionResult {
    switch (optTarget) {
      case OptimizationTarget.TotalDamage: {
        if (
          s2.totalDamages.total > s1.totalDamages.total ||
          (s2.totalDamages.total === s1.totalDamages.total &&
            s2.traceCoords.length < s1.traceCoords.length)
        ) {
          return s2;
        }
        return s1;
      }
      case OptimizationTarget.RedDamage:
      case OptimizationTarget.BlueDamage:
      case OptimizationTarget.GreenDamage:
      case OptimizationTarget.YellowDamage:
      case OptimizationTarget.PurpleDamage: {
        const attr: ColoredPuyoAttribute =
          optTarget - OptimizationTarget.RedDamage + PuyoAttribute.Red;
        if (
          s2.totalDamages[attr] > s1.totalDamages[attr] ||
          (s2.totalDamages[attr] === s1.totalDamages[attr] &&
            s2.traceCoords.length < s1.traceCoords.length)
        ) {
          return s2;
        }
        return s1;
      }
      case OptimizationTarget.PuyoTsukaiCount: {
        if (
          s2.puyoTsukaiCount > s1.puyoTsukaiCount ||
          (s2.puyoTsukaiCount === s1.puyoTsukaiCount &&
            s2.traceCoords.length < s1.traceCoords.length)
        ) {
          return s2;
        }
        return s1;
      }
    }
  }

  private static advanceTrace(
    originalField: Field,
    optTarget: OptimizationTarget,
    state: SolutionState,
    carry: SolutionCarry,
    coord: PuyoCoord
  ): void {
    if (
      !state.checkIfAddableCoord(coord, originalField.getActualMaxTraceNum())
    ) {
      return;
    }

    const s = SolutionState.clone(state);
    s.addTraceCoord(coord);

    Field.updateCarry(
      carry,
      optTarget,
      Field.calcSolutionResult(originalField, s.getTraceCoords())
    );

    for (const nextCoord of s.enumerateCandidates()) {
      Field.advanceTrace(originalField, optTarget, s, carry, nextCoord)!;
    }
  }

  /**
   * 総プリズムダメージを計算する。
   * @param chainDamages
   * @param attr
   * @returns
   */
  public static calcTotalPrismDamage(chainDamages: ChainDamage[]): number {
    const prismDamage = chainDamages.reduce((m, chain) => {
      return m + (chain.damageTerms[PuyoAttribute.Prism]?.strength || 0);
    }, 0);

    return prismDamage;
  }

  /**
   * 対象属性における総ダメージを計算する。
   * @param chainDamages
   * @param targetAttr
   * @returns
   */
  public static calcTotalDamageOfTargetAttr(
    chainDamages: ChainDamage[],
    targetAttr: PuyoAttribute
  ): number {
    const totalAttrDamage = chainDamages.reduce((m, chain) => {
      return m + (chain.damageTerms[targetAttr]?.strength || 0);
    }, 0);
    return totalAttrDamage + Field.calcTotalPrismDamage(chainDamages);
  }

  /**
   * ぷよ使いカウントの総数を計算する。
   * @param chainDamages
   * @returns
   */
  public static calcTotalPuyoTsukaiCount(chainDamages: ChainDamage[]): number {
    return chainDamages.reduce((m, chain) => {
      return m + chain.puyoTsukaiCount;
    }, 0);
  }

  /** なぞられているぷよを消すあるいは色を変えるなどして、最後まで連鎖を続ける */
  public async continueChainsToTheEnd(animate?: {
    onAnimateField: (field: Field, chainDamages: ChainDamage[]) => void;
    onAnimateEnd: (field: Field, chainDamages: ChainDamage[]) => void;
  }) {
    const invokeOnAnimateField = async () => {
      await sleep(this.animationDuration);
      animate?.onAnimateField(this, this.chainDamages);
    };

    this.chainAnimating = true;
    this.currentChainNum = 0;
    this.chainDamages = [];

    // animate オブジェクトがないときの await を出来るだけ回避したいので、
    // やや冗長になっている。

    if (this.popTracingPuyos()) {
      if (animate) {
        await invokeOnAnimateField();
      }

      while (this.dropPuyosOfInField()) {
        if (animate) {
          await invokeOnAnimateField();
        }
        if (this.popPuyoBlocks()) {
          if (animate) {
            await invokeOnAnimateField();
          }
        }
      }

      while (this.dropNextPuyosIntoInField()) {
        if (animate) {
          await invokeOnAnimateField();
        }
        if (this.popPuyoBlocks()) {
          if (animate) {
            await invokeOnAnimateField();
          }
          while (this.dropPuyosOfInField()) {
            if (animate) {
              await invokeOnAnimateField();
            }
            if (this.popPuyoBlocks()) {
              if (animate) {
                await invokeOnAnimateField();
              }
            }
          }
        }
      }
    }

    const chainDamages = this.chainDamages;
    this.currentChainNum = 0;
    this.chainAnimating = false;

    animate?.onAnimateEnd(this, chainDamages);
  }

  /**
   * ぷよが消えるブロックを検出する。(改善版。5%~10%程度速い)
   * @returns 消えるぷよブロックの配列。消えるブロックがなければ長さ０の配列。
   */
  private detectPopBlocks2(): {
    attr: PuyoAttribute;
    coords: Set<PuyoCoord>;
  }[] {
    Field.totalCountOfdetectPopBlocks++;

    const start = performance.now();

    const blocksByColor: Set<PuyoCoord>[][] = [[], [], [], [], []];

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const puyoType = this.cellMatrix[y][x];
        if (!puyoType || !isColoredPuyoType(puyoType)) {
          continue;
        }

        const coord = PuyoCoord.xyToCoord(x, y)!;
        const puyoAttr = getPuyoAttribute(puyoType)! as
          | PuyoAttribute.Red
          | PuyoAttribute.Blue
          | PuyoAttribute.Green
          | PuyoAttribute.Yellow
          | PuyoAttribute.Purple;

        const sameColorBlocks = blocksByColor[puyoAttr - PuyoAttribute.Red];
        const blockIndex = sameColorBlocks.findIndex((b) => b.has(coord));

        let block: Set<PuyoCoord> | undefined;

        if (blockIndex > -1) {
          block = sameColorBlocks.splice(blockIndex, 1)[0];
        }

        const rightCoord = PuyoCoord.xyToCoord(x + 1, y);
        const bottomCoord = PuyoCoord.xyToCoord(x, y + 1);

        const sameColorBiggerNeighborCoords = [rightCoord, bottomCoord].filter(
          (neighborCoord) => {
            if (!neighborCoord) {
              return false;
            }
            const neighborType =
              this.cellMatrix[neighborCoord.y][neighborCoord.x];
            const neighborAttr = getPuyoAttribute(neighborType);
            return neighborAttr === puyoAttr;
          }
        ) as PuyoCoord[];

        const newBlock = block ?? new Set([coord]);

        for (const neighborCoord of sameColorBiggerNeighborCoords) {
          const branchedBlockIndex = sameColorBlocks.findIndex((b) =>
            b.has(neighborCoord)
          );
          let branchedBlock: Set<PuyoCoord> | undefined;
          if (branchedBlockIndex > -1) {
            branchedBlock = sameColorBlocks.splice(branchedBlockIndex, 1)[0];
          }
          if (branchedBlock) {
            for (const crd of branchedBlock) {
              newBlock.add(crd);
            }
          } else {
            newBlock.add(neighborCoord);
          }
        }

        if (newBlock.size > 1) {
          sameColorBlocks.push(newBlock);
        }
      }
    }

    const coloredBlocksToBePopped = blocksByColor.flatMap((blocks, i) => {
      const attr = PuyoAttribute.Red + i;
      return blocks
        .filter((block) => block.size >= this.minimumPuyoNumForPopping)
        .map((block) => {
          return {
            attr,
            coords: block
          };
        });
    });

    const specialBlocksToBePopped: {
      attr: PuyoAttribute;
      coords: Set<PuyoCoord>;
    }[] = [];

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const puyoType = this.cellMatrix[y][x];

        if (!puyoType) {
          continue;
        }

        const puyoAttr = getPuyoAttribute(puyoType);

        if (!puyoAttr || !Field.specialAttrs.includes(puyoAttr)) {
          continue;
        }

        const coord = PuyoCoord.xyToCoord(x, y)!;

        const leftCoord = PuyoCoord.xyToCoord(x - 1, y);
        const topCoord = PuyoCoord.xyToCoord(x, y - 1);
        const rightCoord = PuyoCoord.xyToCoord(x + 1, y);
        const bottomCoord = PuyoCoord.xyToCoord(x, y + 1);

        const neighborCoords = [leftCoord, topCoord, rightCoord, bottomCoord];
        const involvingCoord = neighborCoords.find((c) =>
          coloredBlocksToBePopped.some((b) => b.coords.has(c!))
        );
        const hit = involvingCoord !== undefined;

        if (hit) {
          const block = specialBlocksToBePopped.find(
            (block) => block.attr === puyoAttr
          );
          if (block) {
            block.coords.add(coord);
          } else {
            specialBlocksToBePopped.push({
              attr: puyoAttr,
              coords: new Set([coord])
            });
          }
        }
      }
    }

    const result = coloredBlocksToBePopped.concat(specialBlocksToBePopped);
    const end = performance.now();

    Field.totalTimeOfdetectPopBlocks += end - start;

    return result;
  }

  /**
   * 引っ付いて消えるぷよのブロックがあれば消す。
   * @returns 消しが発生しないとき、undefined。消しが発生するとき、色ごとのダメージ。
   */
  private popPuyoBlocks(): ChainDamage | undefined {
    const blocks = this.detectPopBlocks2();
    const popped = blocks.length > 0;

    if (!popped) {
      return;
    }

    const chainNum = ++this.currentChainNum;
    const poppedPuyoNum = this.calcPoppedPuyoNum(blocks);
    const puyoTsukaiCount = this.calcPuyoTsukaiCount(blocks);

    const result: ChainDamage = {
      chainNum,
      poppedPuyoNum,
      puyoTsukaiCount,
      damageTerms: {} as Record<PuyoAttribute, DamageTerm>
    };

    for (const attr of [
      PuyoAttribute.Red,
      PuyoAttribute.Blue,
      PuyoAttribute.Green,
      PuyoAttribute.Yellow,
      PuyoAttribute.Purple,
      PuyoAttribute.Prism
    ]) {
      if (attr === PuyoAttribute.Prism) {
        const prismBlock = blocks.find((block) => block.attr === attr);
        if (!prismBlock) {
          continue;
        }
        const poppedNum = prismBlock.coords.size;
        result.damageTerms[attr] = {
          strength: 3 * poppedNum,
          poppedNum,
          separatedBlocksNum: 1
        };
      } else {
        const sameColorBlocks = blocks.filter((block) => block.attr === attr);
        const separatedBlocksNum = sameColorBlocks.length;
        const sameColorPoppedNum = sameColorBlocks.reduce((m, block) => {
          const puyoNumInBlock = [...block.coords]
            .map((c) => (isPlusPuyo(this.cellMatrix[c.y][c.x]) ? 2 : 1))
            .reduce((m, n) => m + n, 0);
          return m + puyoNumInBlock;
        }, 0);

        if (separatedBlocksNum === 0) {
          continue;
        }

        const damageStrength = calcDamageTerm(
          1,
          calcPoppingFactor(poppedPuyoNum, separatedBlocksNum, {
            minimumPuyoNumForPopping: this.minimumPuyoNumForPopping,
            poppingLeverage: this.poppingLeverage
          }),
          calcChainFactor(chainNum, this.chainLeverage)
        );

        result.damageTerms[attr] = {
          strength: damageStrength,
          poppedNum: sameColorPoppedNum,
          separatedBlocksNum
        };
      }
    }

    this.chainDamages.push(result);

    for (const block of blocks) {
      if (block.attr === PuyoAttribute.Kata) {
        for (const c of block.coords) {
          this.cellMatrix[c.y][c.x] = PuyoType.Ojyama;
        }
      } else {
        for (const c of block.coords) {
          this.cellMatrix[c.y][c.x] = undefined;
        }
      }
    }

    return result;
  }

  private calcPoppedPuyoNum(
    blocks: { attr: PuyoAttribute; coords: Set<PuyoCoord> }[]
  ) {
    return blocks.reduce((m, block) => {
      // 色ぷよのブロックの場合
      if (isColoredPuyoAttribute(block.attr)) {
        let num = 0;
        for (const coord of block.coords) {
          const puyoType = this.cellMatrix[coord.y][coord.x]!;
          const isPlus = isPlusPuyo(puyoType);
          num += isPlus ? 2 : 1;
        }
        return m + num;
      }

      // 色ぷよ以外のブロックの場合
      const num = [...block.coords.values()].filter((coord) => {
        const puyoType = this.cellMatrix[coord.y][coord.x]!;
        // TODO: 固ぷよが同時消し数に含まれるかどうか要調査
        // https://kayagrv.com/entry/2019/10/05/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F%E5%9F%BA%E7%A4%8E
        return puyoType !== PuyoType.Kata && puyoType !== PuyoType.Heart;
      }).length;
      return m + num;
    }, 0);
  }

  private coordIsInBoostArea(coord: PuyoCoord): boolean {
    for (const boostArea of this.boostAreaCoordSetList) {
      if (boostArea.has(coord)) {
        return true;
      }
    }
    return false;
  }

  private calcPuyoTsukaiCount(
    blocks: { attr: PuyoAttribute; coords: Set<PuyoCoord> }[]
  ) {
    return blocks.reduce((m, block) => {
      // 色ぷよのブロックの場合
      if (isColoredPuyoAttribute(block.attr)) {
        let num = 0;
        for (const coord of block.coords) {
          const puyoType = this.cellMatrix[coord.y][coord.x]!;
          const plusFactor = isPlusPuyo(puyoType) ? 2 : 1;
          const boostFactor = this.coordIsInBoostArea(coord) ? 3 : 1;
          num += plusFactor * boostFactor;
        }
        return m + num;
      }

      // 固ぷよブロックの場合
      if (
        block.attr === PuyoAttribute.Kata ||
        block.attr === PuyoAttribute.Padding
      ) {
        // カウントしない
        return m;
      }

      // その他のブロック(ハート、プリズム、おじゃま)の場合
      let num = 0;
      for (const coord of block.coords) {
        const boostFactor = this.coordIsInBoostArea(coord) ? 3 : 1;
        num += boostFactor;
      }
      return m + num;
    }, 0);
  }

  /**
   * なぞり消しモードが通常であれば、なぞり中のぷよを消す。
   * 色変えモードであれば、なぞり中のぷよの色を変えその結果消える箇所を消す。
   */
  private popTracingPuyos(): boolean | ChainDamage | undefined {
    let popped: boolean | ChainDamage | undefined = false;

    if (this.traceMode === TraceMode.Normal) {
      for (const c of this.traceCoords) {
        this.cellMatrix[c.y][c.x] = undefined;
        popped = true;
      }
    } else {
      const puyoAttr = this.traceMode as number as PuyoAttribute;
      if (!isColoredPuyoAttribute(puyoAttr)) {
        throw new Error('traceMode is invalid.');
      }
      for (const c of this.traceCoords) {
        const puyoType = this.cellMatrix[c.y][c.x];
        if (!puyoType) {
          continue;
        }
        this.cellMatrix[c.y][c.x] = convertPuyoType(puyoType, puyoAttr);
      }
      popped = this.popPuyoBlocks();
    }

    this.traceCoords = [];

    return popped;
  }

  /** インフィールドのセルに隙間があればぷよを落として隙間を埋める。 (ネクストぷよはそのまま) */
  private dropPuyosOfInField(): boolean {
    let dropped = false;

    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const colPuyosFromBottom = [...new Array(PuyoCoord.YNum)]
        .map((_, y) => {
          return this.cellMatrix[y][x];
        })
        .reverse()
        .filter(Boolean);

      for (let ry = 0; ry < PuyoCoord.YNum; ry++) {
        const puyo = colPuyosFromBottom[ry];
        const prevY = PuyoCoord.YNum - 1 - ry;
        const prevPuyo = this.cellMatrix[prevY][x];
        this.cellMatrix[prevY][x] = puyo;

        if (prevPuyo !== puyo) {
          dropped = true;
        }
      }
    }

    return dropped;
  }

  /** ネクストぷよをインフィールドに落として隙間を埋める。 */
  private dropNextPuyosIntoInField(): boolean {
    let dropped = false;

    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const colPuyos = [...new Array(PuyoCoord.YNum)].map((_, y) => {
        return this.cellMatrix[y][x];
      });
      const colPuyoNum = colPuyos.reduce((m, puyo) => (puyo ? m + 1 : m), 0);

      if (colPuyoNum === PuyoCoord.YNum) {
        continue;
      }

      const initialY = PuyoCoord.YNum - 1 - colPuyoNum;
      const nextPuyo = this.nextPuyos[x] ?? PuyoType.Padding;

      for (let y = initialY; y >= 0; y--) {
        this.cellMatrix[y][x] = y === initialY ? nextPuyo : PuyoType.Padding;
      }

      this.nextPuyos[x] = undefined;

      dropped = true;
    }

    return dropped;
  }
}
