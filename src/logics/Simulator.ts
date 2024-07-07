import type { Board } from './Board';
import type { AttributeChain, Chain } from './Chain';
import { type Puyo, generatePuyoId } from './Puyo';
import { PuyoAttribute, isColoredPuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import {
  PuyoType,
  convertPuyoType,
  getPuyoAttribute,
  isColoredPuyoType,
  isPlusPuyo
} from './PuyoType';
import { TraceMode } from './TraceMode';
import { calcChainFactor, calcDamageTerm, calcPoppingFactor } from './damage';
import { choice, shuffle } from './generics/random';
import { sleep } from './generics/sleep';

/** 連鎖シミュレーター */
export class Simulator {
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

  /** フィールドは 8x6 のぷよ行列 */
  private readonly field: (Puyo | undefined)[][];

  /** ネクストぷよは 8つのぷよからなる。(実際は無限に上に連なっているはずだが割愛) */
  private nextPuyos: (Puyo | undefined)[];

  private boostAreaCoordSetList: ReadonlySet<PuyoCoord>[] = [];
  private isChanceMode = false;
  private traceCoords: PuyoCoord[] = [];
  private minimumPuyoNumForPopping = Simulator.defaultMinimumPuyoNumForPopping;
  private maxTraceNum = Simulator.defaultMaxTraceNum;
  private traceMode = TraceMode.Normal;
  private poppingLeverage = 1.0;
  private chainLeverage = 1.0;
  private chainAnimating = false;
  private animationDuration = Simulator.defaultAnimationDuration;
  private currentChainNum = 0;
  private chains: Chain[] = [];

  /**
   * インスタンスの指定があればそれをコピーする。そうでなければ初期化する。
   * @param simulator
   */
  constructor(simulator?: Simulator) {
    if (simulator) {
      this.field = simulator.field.map((row) => [...row]);
      this.nextPuyos = [...simulator.nextPuyos];
      this.boostAreaCoordSetList = [...simulator.boostAreaCoordSetList];
      this.isChanceMode = simulator.isChanceMode;
      this.traceCoords = [...simulator.traceCoords];
      this.minimumPuyoNumForPopping = simulator.minimumPuyoNumForPopping;
      this.maxTraceNum = simulator.maxTraceNum;
      this.traceMode = simulator.traceMode;
      this.poppingLeverage = simulator.poppingLeverage;
      this.chainLeverage = simulator.chainLeverage;
      this.chainAnimating = simulator.chainAnimating;
      this.animationDuration = simulator.animationDuration;
      this.currentChainNum = simulator.currentChainNum;
      this.chains = [...simulator.chains];
    } else {
      this.field = [...new Array(PuyoCoord.YNum)].map(
        () => new Array(PuyoCoord.XNum)
      );
      this.nextPuyos = new Array(PuyoCoord.XNum);
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
  public getField(): (Puyo | undefined)[][] {
    return this.field;
  }

  /** ネクストぷよ配列を取得する。 */
  public getNextPuyos(): (Puyo | undefined)[] {
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

  /** 現在のなぞり座標リストを取得する。 */
  public getCurrentTracingCoords() {
    return this.traceCoords;
  }

  /** 全連鎖情報を取得する。 */
  public getChains() {
    return this.chains;
  }

  /** シミュレーターをクリアする。 */
  public clear(): void {
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
    this.chainAnimating = false;
    this.animationDuration = Simulator.defaultAnimationDuration;
    this.currentChainNum = 0;
  }

  public clone(): Simulator {
    return new Simulator(this);
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
      this.nextPuyos[x] = {
        id: generatePuyoId(),
        type: choice(possibleNextPuyoTypes)
      };
    }
  }

  /**
   * ネクストぷよを同種のぷよでリセットする。
   * @param type ぷよの型
   */
  public resetNextPuyosAsSameType(type: PuyoType): void {
    for (let x = 0; x < PuyoCoord.XNum; x++) {
      this.nextPuyos[x] = {
        id: generatePuyoId(),
        type
      };
    }
  }

  /**
   * 連鎖の種やとくべつルールなど固定のボードからシミュレーターをリセットする
   * @param board 連鎖の種やとくべつルールなど固定のボード
   */
  public resetWithBoard(board: Board): void {
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
        const type = board.nextPuyos[x];
        this.nextPuyos[x] = type
          ? {
              id: generatePuyoId(),
              type
            }
          : undefined;
      }
    }

    const field = board.field;

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const type = field[y][x];
        this.field[y][x] = type
          ? {
              id: generatePuyoId(),
              type
            }
          : undefined;
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
        const id = generatePuyoId();

        for (let i = 0; i < candidateTypes.length; i++) {
          const type = candidateTypes[i];

          this.field[y][x] = {
            id,
            type
          };

          if (this.detectPopBlocks().length === 0) {
            ok = true;
            break;
          }

          this.field[y][x] = undefined;
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

    const puyo = this.field[puyoCoord.y][puyoCoord.x];
    if (!puyo) {
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

  /**
   * 総プリズムダメージを計算する。
   * @param chains
   * @param attr
   * @returns
   */
  public static calcTotalPrismDamage(chains: Chain[]): number {
    const prismDamage = chains.reduce((m, chain) => {
      return m + (chain.attributes[PuyoAttribute.Prism]?.strength || 0);
    }, 0);

    return prismDamage;
  }

  /**
   * 対象属性における総ダメージを計算する。
   * @param chains
   * @param targetAttr
   * @returns
   */
  public static calcTotalDamageOfTargetAttr(
    chains: Chain[],
    targetAttr: PuyoAttribute
  ): number {
    const totalAttrDamage = chains.reduce((m, chain) => {
      return m + (chain.attributes[targetAttr]?.strength || 0);
    }, 0);
    return totalAttrDamage + Simulator.calcTotalPrismDamage(chains);
  }

  /**
   * ぷよ使いカウントの総数を計算する。
   * @param chains
   * @returns
   */
  public static calcTotalPuyoTsukaiCount(chains: Chain[]): number {
    return chains.reduce((m, chain) => {
      return m + chain.puyoTsukaiCount;
    }, 0);
  }

  /** なぞられているぷよを消すあるいは色を変えるなどして、最後まで連鎖を続ける */
  public async doChains(animate?: {
    onAnimateStep: (simulator: Simulator, chains: Chain[]) => void;
    onAnimateEnd: (simulator: Simulator, chains: Chain[]) => void;
  }) {
    const invokeOnAnimateField = async () => {
      await sleep(this.animationDuration);
      animate?.onAnimateStep(this, this.chains);
    };

    this.chainAnimating = true;
    this.currentChainNum = 0;
    this.chains = [];

    // animate オブジェクトがないときの await を出来るだけ回避したいので、
    // やや冗長になっている。

    if (this.popTracingPuyos()) {
      if (animate) {
        await invokeOnAnimateField();
      }

      while (this.dropInField()) {
        if (animate) {
          await invokeOnAnimateField();
        }
        if (this.popPuyoBlocks()) {
          if (animate) {
            await invokeOnAnimateField();
          }
        }
      }

      while (this.dropNextIntoField()) {
        if (animate) {
          await invokeOnAnimateField();
        }
        if (this.popPuyoBlocks()) {
          if (animate) {
            await invokeOnAnimateField();
          }
          while (this.dropInField()) {
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

    const chains = this.chains;
    this.currentChainNum = 0;
    this.chainAnimating = false;

    animate?.onAnimateEnd(this, chains);
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
    const puyoTsukaiCount = this.calcPuyoTsukaiCount(blocks);

    const result: Chain = {
      chainNum,
      poppedPuyoNum,
      puyoTsukaiCount,
      attributes: {} as Record<PuyoAttribute, AttributeChain>
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
        const poppedNum = prismBlock.coordIdMap.size;
        result.attributes[attr] = {
          strength: 3 * poppedNum,
          poppedNum,
          separatedBlocksNum: 1
        };
      } else {
        const sameColorBlocks = blocks.filter((block) => block.attr === attr);
        const separatedBlocksNum = sameColorBlocks.length;
        const sameColorPoppedNum = sameColorBlocks.reduce((m, block) => {
          const puyoNumInBlock = [...block.coordIdMap]
            .map(([c]) => (isPlusPuyo(this.field[c.y][c.x]!.type) ? 2 : 1))
            .reduce((m, n) => m + n, 0);
          return m + puyoNumInBlock;
        }, 0);

        if (separatedBlocksNum === 0) {
          continue;
        }

        const strength = calcDamageTerm(
          1,
          calcPoppingFactor(poppedPuyoNum, separatedBlocksNum, {
            minimumPuyoNumForPopping: this.minimumPuyoNumForPopping,
            poppingLeverage: this.poppingLeverage
          }),
          calcChainFactor(chainNum, this.chainLeverage)
        );

        result.attributes[attr] = {
          strength,
          poppedNum: sameColorPoppedNum,
          separatedBlocksNum
        };
      }
    }

    this.chains.push(result);

    for (const block of blocks) {
      if (block.attr === PuyoAttribute.Kata) {
        for (const [c] of block.coordIdMap) {
          this.field[c.y][c.x] = {
            id: this.field[c.y][c.x]!.id,
            type: PuyoType.Ojyama
          };
        }
      } else {
        for (const [c] of block.coordIdMap) {
          this.field[c.y][c.x] = undefined;
        }
      }
    }

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
    for (const boostArea of this.boostAreaCoordSetList) {
      if (boostArea.has(coord)) {
        return true;
      }
    }
    return false;
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
