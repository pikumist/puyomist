/**
 * @module ぷよクエのシミュレータ
 * @license pikumist
 *
 * Copyright (c) pikumist. and its contributers.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type AnimationStep, cloneFieldAndNext } from './AnimationStep';
import type { AttributeChain, Chain } from './Chain';
import { type Puyo, generatePuyoId } from './Puyo';
import {
  PuyoAttribute,
  coloredPuyoAttributeList,
  isColoredPuyoAttribute
} from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import {
  PuyoType,
  convertPuyoType,
  getPuyoAttribute,
  isChancePuyo,
  isColoredPuyoType,
  isPlusPuyo
} from './PuyoType';
import type { SimulationData } from './SimulationData';
import { TraceMode } from './TraceMode';
import { calcChainFactor, calcDamageTerm, calcPoppingFactor } from './damage';

/** 連鎖シミュレーター */
export class Simulator {
  static readonly colorAttrs: ReadonlyArray<PuyoAttribute> =
    coloredPuyoAttributeList;
  static readonly specialAttrs: ReadonlyArray<PuyoAttribute> = [
    PuyoAttribute.Heart,
    PuyoAttribute.Prism,
    PuyoAttribute.Ojama,
    PuyoAttribute.Kata
  ];

  static readonly defaultMinimumPuyoNumForPopping = 4;
  static readonly defaultMaxTraceNum = 5;
  static readonly defaultAnimationDuration = 200;

  /** フィールドは 8x6 のぷよ行列 */
  private readonly field: (Puyo | undefined)[][];

  /** ネクストぷよは 8つのぷよからなる。(実際は無限に上に連なっているはずだが割愛) */
  private nextPuyos: (Puyo | undefined)[];

  private boostAreaCoordList: PuyoCoord[] = [];
  private boostAreaCoordSet: ReadonlySet<PuyoCoord> = new Set([]);
  private isChanceMode = false;
  private traceCoords: PuyoCoord[] = [];
  private minimumPuyoNumForPopping = Simulator.defaultMinimumPuyoNumForPopping;
  private maxTraceNum = Simulator.defaultMaxTraceNum;
  private traceMode = TraceMode.Normal;
  private poppingLeverage = 1.0;
  private chainLeverage = 1.0;
  private animationDuration = Simulator.defaultAnimationDuration;
  private currentChainNum = 0;
  private chains: Chain[] = [];

  /**
   * インスタンスの指定があればそれをコピーする。そうでなければ初期化する。
   * @param simulationData
   */
  constructor(simulationData?: SimulationData) {
    if (simulationData) {
      this.field = simulationData.field.map((row) => [...row]);
      this.nextPuyos = [...simulationData.nextPuyos];
      this.boostAreaCoordList = simulationData.boostAreaCoordList;
      this.boostAreaCoordSet = new Set(simulationData.boostAreaCoordList);
      this.isChanceMode = simulationData.isChanceMode;
      this.traceCoords = [...simulationData.traceCoords];
      this.minimumPuyoNumForPopping = simulationData.minimumPuyoNumForPopping;
      this.maxTraceNum = simulationData.maxTraceNum;
      this.traceMode = simulationData.traceMode;
      this.poppingLeverage = simulationData.poppingLeverage;
      this.chainLeverage = simulationData.chainLeverage;
      this.animationDuration = simulationData.animationDuration;
    } else {
      this.field = [...new Array(PuyoCoord.YNum)].map(() => [
        ...new Array(PuyoCoord.XNum)
      ]);
      this.nextPuyos = [...new Array(PuyoCoord.XNum)];
      this.clear();
    }
  }

  /** シミュレーションに必要なデータ(入力データ)を取得する */
  getSimulationData(): SimulationData {
    return {
      nextPuyos: this.nextPuyos,
      field: this.field,
      boostAreaCoordList: this.boostAreaCoordList,
      isChanceMode: this.isChanceMode,
      traceCoords: this.traceCoords,
      minimumPuyoNumForPopping: this.minimumPuyoNumForPopping,
      maxTraceNum: this.maxTraceNum,
      traceMode: this.traceMode,
      poppingLeverage: this.poppingLeverage,
      chainLeverage: this.chainLeverage,
      animationDuration: this.animationDuration
    };
  }

  /** 実質の最大なぞり消し数を取得する。チャンスモード中は5に制限される。 */
  getActualMaxTraceNum(): number {
    return this.isChanceMode ? 5 : this.maxTraceNum;
  }

  /** 全連鎖情報を取得する。 */
  getChains() {
    return this.chains;
  }

  /** フィールドを取得する。(解探索でのみ使う) */
  getField() {
    return this.field;
  }

  /** シミュレーターをクリアする。 */
  clear(): void {
    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        this.field[y][x] = undefined;
      }
    }
    for (let i = 0; i < PuyoCoord.XNum; i++) {
      this.nextPuyos[i] = undefined;
    }

    this.isChanceMode = false;
    this.maxTraceNum = Simulator.defaultMaxTraceNum;
    this.animationDuration = Simulator.defaultAnimationDuration;
    this.currentChainNum = 0;
  }

  /** なぞり中のぷよを一気にセットする。最適解探索時やテストで使う。 */
  setTraceCoords(puyoCoords: PuyoCoord[]) {
    this.traceCoords = puyoCoords;
  }

  /**
   * 全消しされたかどうか
   * @param chains
   * @returns
   */
  static isAllCleared(chains: Chain[]): boolean {
    return chains.some((chain) => chain.allCleared);
  }

  /**
   * チャンスぷよが弾けたかどうか
   * @param chains
   * @returns
   */
  static isChancePopped(chains: Chain[]): boolean {
    return chains.some((chain) => chain.chancePopped);
  }

  /**
   * 総プリズムダメージを計算する。
   * @param chains
   * @returns
   */
  static calcTotalPrismDamage(chains: Chain[]): number {
    const prismDamage = chains.reduce((m, chain) => {
      return m + (chain.attributes[PuyoAttribute.Prism]?.strength || 0);
    }, 0);

    return prismDamage;
  }

  /**
   * 対象属性における総ダメージを計算する。(プリズムのダメージも含む)
   * @param chains
   * @param targetAttr
   * @returns
   */
  static calcTotalDamageOfTargetAttr(
    chains: Chain[],
    targetAttr: PuyoAttribute
  ): number {
    const totalAttrDamage = chains.reduce((m, chain) => {
      return m + (chain.attributes[targetAttr]?.strength || 0);
    }, 0);
    const boostRatio = Simulator.calcBoostRatio(chains);
    return (
      boostRatio * (totalAttrDamage + Simulator.calcTotalPrismDamage(chains))
    );
  }

  /**
   * ワイルドにおける総ダメージを計算する。(プリズムのダメージも含む)
   * @param chains
   * @param targetAttr
   * @returns
   */
  static calcTotalWildDamage(chains: Chain[]): number {
    const totalWildDamage = chains.reduce((m, chain) => {
      return m + chain.wild.strength;
    }, 0);
    const boostRatio = Simulator.calcBoostRatio(chains);
    return (
      boostRatio * (totalWildDamage + Simulator.calcTotalPrismDamage(chains))
    );
  }

  /**
   * 対象属性における総カウントを計算する。
   * @param chains
   * @param targetAttr
   * @returns
   */
  static calcTotalCountOfTargetAttr(
    chains: Chain[],
    targetAttr: PuyoAttribute
  ): number {
    const totalCount = chains.reduce((m, chain) => {
      return m + (chain.attributes[targetAttr]?.poppedNum ?? 0);
    }, 0);
    return totalCount;
  }

  /**
   * ブーストカウントの総数を計算する。
   * @param chains
   * @returns
   */
  static calcTotalBoostCount(chains: Chain[]): number {
    return chains.reduce((m, chain) => {
      return m + chain.boostCount;
    }, 0);
  }

  /**
   * ブーストカウントによる倍率を計算する。
   * @param chains
   * @returns
   */
  static calcBoostRatio(chains: Chain[]): number {
    const boostCount = Math.min(Simulator.calcTotalBoostCount(chains), 50);
    return 1 + boostCount * 0.04;
  }

  /**
   * ぷよ使いカウントの総数を計算する。
   * @param chains
   * @returns
   */
  static calcTotalPuyoTsukaiCount(chains: Chain[]): number {
    return chains.reduce((m, chain) => {
      return m + chain.puyoTsukaiCount;
    }, 0);
  }

  /**
   * なぞられているぷよを消すあるいは色を変えるなどして、最後まで連鎖を続ける。
   * @param animate true のときアニメーションステップのリストを返す。
   */
  doChains(animate?: boolean): AnimationStep[] | undefined {
    const animationSteps: AnimationStep[] = [];

    const invokeOnAnimateField = () => {
      animationSteps.push({
        ...cloneFieldAndNext(this.getSimulationData()),
        chains: [...this.chains]
      });
    };

    this.currentChainNum = 0;
    this.chains = [];

    if (animate) {
      invokeOnAnimateField();
    }

    // animate オブジェクトがないときの await を出来るだけ回避したいので、
    // やや冗長になっている。

    if (this.popTracingPuyos()) {
      if (animate) {
        invokeOnAnimateField();
      }

      while (this.dropInField()) {
        if (animate) {
          invokeOnAnimateField();
        }
        if (this.popPuyoBlocks()) {
          if (animate) {
            invokeOnAnimateField();
          }
        }
      }

      while (this.dropNextIntoField()) {
        if (animate) {
          invokeOnAnimateField();
        }
        if (this.popPuyoBlocks()) {
          if (animate) {
            invokeOnAnimateField();
          }
          while (this.dropInField()) {
            if (animate) {
              invokeOnAnimateField();
            }
            if (this.popPuyoBlocks()) {
              if (animate) {
                invokeOnAnimateField();
              }
            }
          }
        }
      }
    }

    this.currentChainNum = 0;

    if (animate) {
      return animationSteps;
    }
  }

  /**
   * ぷよが消えるブロックを検出する。
   * @returns 消えるぷよブロックの配列。消えるブロックがなければ長さ０の配列。
   */
  private detectPopBlocks(): {
    attr: PuyoAttribute;
    coordIdMap: Map<PuyoCoord, number>;
  }[] {
    const blocksByColor: Map<PuyoCoord, number>[][] = [[], [], [], [], []];

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const puyo = this.field[y][x];
        if (!puyo || !isColoredPuyoType(puyo.type)) {
          continue;
        }

        const id = puyo.id;
        const coord = PuyoCoord.xyToCoord(x, y)!;
        const puyoAttr = getPuyoAttribute(puyo.type)! as
          | PuyoAttribute.Red
          | PuyoAttribute.Blue
          | PuyoAttribute.Green
          | PuyoAttribute.Yellow
          | PuyoAttribute.Purple;

        const sameColorBlocks = blocksByColor[puyoAttr - PuyoAttribute.Red];
        const blockIndex = sameColorBlocks.findIndex((b) => b.has(coord));

        let block: Map<PuyoCoord, number> | undefined;

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
            const neighborPuyo = this.field[neighborCoord.y][neighborCoord.x];
            const neighborAttr = getPuyoAttribute(neighborPuyo?.type);
            return neighborAttr === puyoAttr;
          }
        ) as PuyoCoord[];

        const newBlock = block ?? new Map([[coord, id]]);

        for (const neighborCoord of sameColorBiggerNeighborCoords) {
          const branchedBlockIndex = sameColorBlocks.findIndex((b) =>
            b.has(neighborCoord)
          );
          let branchedBlock: Map<PuyoCoord, number> | undefined;
          if (branchedBlockIndex > -1) {
            branchedBlock = sameColorBlocks.splice(branchedBlockIndex, 1)[0];
          }
          if (branchedBlock) {
            for (const [coord, id] of branchedBlock) {
              newBlock.set(coord, id);
            }
          } else {
            newBlock.set(
              neighborCoord,
              this.field[neighborCoord.y][neighborCoord.x]!.id
            );
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
            coordIdMap: block
          };
        });
    });

    const specialBlocksToBePopped: {
      attr: PuyoAttribute;
      coordIdMap: Map<PuyoCoord, number>;
    }[] = [];

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const puyo = this.field[y][x];

        if (!puyo) {
          continue;
        }

        const puyoAttr = getPuyoAttribute(puyo.type);

        if (!puyoAttr || !Simulator.specialAttrs.includes(puyoAttr)) {
          continue;
        }

        const id = puyo.id;
        const coord = PuyoCoord.xyToCoord(x, y)!;

        const leftCoord = PuyoCoord.xyToCoord(x - 1, y);
        const topCoord = PuyoCoord.xyToCoord(x, y - 1);
        const rightCoord = PuyoCoord.xyToCoord(x + 1, y);
        const bottomCoord = PuyoCoord.xyToCoord(x, y + 1);

        const neighborCoords = [leftCoord, topCoord, rightCoord, bottomCoord];
        const involvingCoord = neighborCoords.find((c) =>
          coloredBlocksToBePopped.some((b) => b.coordIdMap.has(c!))
        );
        const hit = involvingCoord !== undefined;

        if (hit) {
          const block = specialBlocksToBePopped.find(
            (block) => block.attr === puyoAttr
          );
          if (block) {
            block.coordIdMap.set(coord, id);
          } else {
            specialBlocksToBePopped.push({
              attr: puyoAttr,
              coordIdMap: new Map([[coord, id]])
            });
          }
        }
      }
    }

    const result = coloredBlocksToBePopped.concat(specialBlocksToBePopped);

    return result;
  }

  /**
   * 引っ付いて消えるぷよのブロックがあれば消す。
   * @returns 消しが発生しないとき、undefined。消しが発生するとき、色ごとのダメージ。
   */
  private popPuyoBlocks(): Chain | undefined {
    const blocks = this.detectPopBlocks();
    const popped = blocks.length > 0;

    if (!popped) {
      return;
    }

    const chainNum = ++this.currentChainNum;
    const poppedPuyoNum = this.calcPoppedPuyoNum(blocks);
    const boostCount = this.calcBoostCount(blocks);
    const puyoTsukaiCount = this.calcPuyoTsukaiCount(blocks);

    const result: Chain = {
      chainNum,
      poppedPuyoNum,
      boostCount,
      puyoTsukaiCount,
      attributes: {} as Record<PuyoAttribute, AttributeChain>,
      wild: {
        strength: 0,
        separatedBlocksNum: 0
      }
    };

    for (const attr of [
      PuyoAttribute.Red,
      PuyoAttribute.Blue,
      PuyoAttribute.Green,
      PuyoAttribute.Yellow,
      PuyoAttribute.Purple,
      PuyoAttribute.Heart,
      PuyoAttribute.Prism,
      PuyoAttribute.Ojama
    ]) {
      if (
        attr === PuyoAttribute.Heart ||
        attr === PuyoAttribute.Prism ||
        attr === PuyoAttribute.Ojama
      ) {
        const block = blocks.find((block) => block.attr === attr);
        if (!block) {
          continue;
        }
        const poppedNum = block.coordIdMap.size;
        result.attributes![attr] = {
          strength: attr === PuyoAttribute.Prism ? 3 * poppedNum : 0,
          poppedNum,
          separatedBlocksNum: 0
        };
      } else {
        const sameColorBlocks = blocks.filter((block) => block.attr === attr);
        const separatedBlocksNum = sameColorBlocks.length;

        if (separatedBlocksNum === 0) {
          continue;
        }

        const sameColorPoppedNum = sameColorBlocks.reduce((m, block) => {
          const puyoNumInBlock = [...block.coordIdMap]
            .map(([c]) => (isPlusPuyo(this.field[c.y][c.x]!.type) ? 2 : 1))
            .reduce((m, n) => m + n, 0);
          return m + puyoNumInBlock;
        }, 0);

        const strength = calcDamageTerm(
          1,
          calcPoppingFactor(poppedPuyoNum, separatedBlocksNum, {
            minimumPuyoNumForPopping: this.minimumPuyoNumForPopping,
            poppingLeverage: this.poppingLeverage
          }),
          calcChainFactor(chainNum, this.chainLeverage)
        );

        result.attributes![attr] = {
          strength,
          poppedNum: sameColorPoppedNum,
          separatedBlocksNum
        };
      }
    }

    for (const block of blocks) {
      if (block.attr === PuyoAttribute.Kata) {
        for (const [c] of block.coordIdMap) {
          this.field[c.y][c.x] = {
            id: this.field[c.y][c.x]!.id,
            type: PuyoType.Ojama
          };
        }
      } else {
        for (const [c] of block.coordIdMap) {
          if (isChancePuyo(this.field[c.y][c.x]!.type)) {
            result.chancePopped = true;
          }
          this.field[c.y][c.x] = undefined;
        }
      }
    }

    const allCleared = this.field.every((row) => row.every((puyo) => !puyo));
    if (allCleared) {
      result.allCleared = allCleared;
    }

    result.wild.separatedBlocksNum = Simulator.colorAttrs.reduce(
      (m, attr) => m + (result.attributes![attr]?.separatedBlocksNum ?? 0),
      0
    );
    result.wild.strength = calcDamageTerm(
      1,
      calcPoppingFactor(poppedPuyoNum, result.wild.separatedBlocksNum, {
        minimumPuyoNumForPopping: this.minimumPuyoNumForPopping,
        poppingLeverage: this.poppingLeverage
      }),
      calcChainFactor(chainNum, this.chainLeverage)
    );

    this.chains.push(result);

    return result;
  }

  private calcPoppedPuyoNum(
    blocks: { attr: PuyoAttribute; coordIdMap: Map<PuyoCoord, number> }[]
  ) {
    return blocks.reduce((m, block) => {
      // 色ぷよのブロックの場合
      if (isColoredPuyoAttribute(block.attr)) {
        let num = 0;
        for (const [coord] of block.coordIdMap) {
          const puyo = this.field[coord.y][coord.x]!;
          const isPlus = isPlusPuyo(puyo.type);
          num += isPlus ? 2 : 1;
        }
        return m + num;
      }

      // 色ぷよ以外のブロックの場合
      const num = [...block.coordIdMap.keys()].filter((coord) => {
        const puyo = this.field[coord.y][coord.x]!;
        const type = puyo.type;
        // TODO: 固ぷよが同時消し数に含まれるかどうか要調査
        // https://kayagrv.com/entry/2019/10/05/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F%E5%9F%BA%E7%A4%8E
        return type !== PuyoType.Kata && type !== PuyoType.Heart;
      }).length;
      return m + num;
    }, 0);
  }

  private coordIsInBoostArea(coord: PuyoCoord): boolean {
    return this.boostAreaCoordSet.has(coord);
  }

  private calcBoostCount(
    blocks: { attr: PuyoAttribute; coordIdMap: Map<PuyoCoord, number> }[]
  ) {
    return blocks.reduce((m, block) => {
      // 色ぷよのブロックの場合
      if (isColoredPuyoAttribute(block.attr)) {
        let num = 0;
        for (const [coord] of block.coordIdMap) {
          if (!this.coordIsInBoostArea(coord)) {
            continue;
          }
          const puyo = this.field[coord.y][coord.x]!;
          num += isPlusPuyo(puyo.type) ? 2 : 1;
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
      for (const [coord] of block.coordIdMap) {
        if (!this.coordIsInBoostArea(coord)) {
          continue;
        }
        num += 1;
      }
      return m + num;
    }, 0);
  }

  private calcPuyoTsukaiCount(
    blocks: { attr: PuyoAttribute; coordIdMap: Map<PuyoCoord, number> }[]
  ) {
    return blocks.reduce((m, block) => {
      // 色ぷよのブロックの場合
      if (isColoredPuyoAttribute(block.attr)) {
        let num = 0;
        for (const [coord] of block.coordIdMap) {
          const puyo = this.field[coord.y][coord.x]!;
          const plusFactor = isPlusPuyo(puyo.type) ? 2 : 1;
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
      for (const [coord] of block.coordIdMap) {
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
  private popTracingPuyos(): boolean | Chain | undefined {
    let popped: boolean | Chain | undefined = false;

    if (this.traceMode === TraceMode.Normal) {
      for (const c of this.traceCoords) {
        this.field[c.y][c.x] = undefined;
        popped = true;
      }
    } else {
      const puyoAttr = this.traceMode as number as PuyoAttribute;
      if (!isColoredPuyoAttribute(puyoAttr)) {
        throw new Error('traceMode is invalid.');
      }
      for (const c of this.traceCoords) {
        const puyo = this.field[c.y][c.x];
        if (!puyo) {
          continue;
        }
        this.field[c.y][c.x] = {
          id: puyo.id,
          type: convertPuyoType(puyo.type, puyoAttr)
        };
      }
      popped = this.popPuyoBlocks();
    }

    this.traceCoords = [];

    return popped;
  }

  /** フィールドのセルに隙間があればぷよを落として隙間を埋める。 (ネクストぷよはそのまま) */
  private dropInField(): boolean {
    let dropped = false;

    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const colPuyosFromBottom = [...new Array(PuyoCoord.YNum)]
        .map((_, y) => {
          return this.field[y][x];
        })
        .reverse()
        .filter(Boolean);

      for (let ry = 0; ry < PuyoCoord.YNum; ry++) {
        const puyo = colPuyosFromBottom[ry];
        const prevY = PuyoCoord.YNum - 1 - ry;
        const prevPuyo = this.field[prevY][x];
        this.field[prevY][x] = puyo;

        if (prevPuyo !== puyo) {
          dropped = true;
        }
      }
    }

    return dropped;
  }

  /** ネクストぷよをフィールドに落として隙間を埋める。 */
  private dropNextIntoField(): boolean {
    let dropped = false;

    for (let x = 0; x < PuyoCoord.XNum; x++) {
      const colPuyos = [...new Array(PuyoCoord.YNum)].map((_, y) => {
        return this.field[y][x];
      });
      const colPuyoNum = colPuyos.reduce((m, puyo) => (puyo ? m + 1 : m), 0);

      if (colPuyoNum === PuyoCoord.YNum) {
        continue;
      }

      const initialY = PuyoCoord.YNum - 1 - colPuyoNum;
      const nextPuyo = this.nextPuyos[x] ?? {
        id: generatePuyoId(),
        type: PuyoType.Padding
      };

      for (let y = initialY; y >= 0; y--) {
        this.field[y][x] =
          y === initialY
            ? nextPuyo
            : { id: generatePuyoId(), type: PuyoType.Padding };
      }

      this.nextPuyos[x] = undefined;

      dropped = true;
    }

    return dropped;
  }
}
