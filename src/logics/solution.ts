import type { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';
import { bitFieldAddIndex, bitFieldHasIndex } from './bit-field';
import type { ChainDamage } from './damage';
import { PuyoAttribute } from './puyo';

/** 各属性における総ダメージ */
export interface TotalDamages {
  /** 全ての属性における総ダメージ */
  total: number;
  /** 赤属性における総ダメージ */
  [PuyoAttribute.Red]: number;
  /** 青属性における総ダメージ */
  [PuyoAttribute.Blue]: number;
  /** 緑属性における総ダメージ */
  [PuyoAttribute.Green]: number;
  /** 黄属性における総ダメージ */
  [PuyoAttribute.Yellow]: number;
  /** 紫属性における総ダメージ */
  [PuyoAttribute.Purple]: number;
}

/** なぞり消し(塗り)した結果 */
export interface SolutionResult {
  /** なぞったぷよ */
  traceCoords: PuyoCoord[];
  /** ぷよ使いカウント */
  puyoTsukaiCount: number;
  /** 各属性における総ダメージ */
  totalDamages: TotalDamages;
  /** 連鎖ダメージ情報 (元情報) */
  chainDamages: ChainDamage[];
}

/** solve() メソッドの呼び出し結果 */
export interface SolvedResult {
  /** 探索法 */
  solutionMethod?: SolutionMethod;
  /** 最適化対象 */
  optimizationTarget: OptimizationTarget;
  /** 経過時間 */
  elapsedTime: number;
  /** 候補数 */
  candidatesNum: number;
  /** 最適解 */
  optimalSolution: SolutionResult | undefined;
}

export class SolutionState {
  /** 禁止インデックス集合 (候補から外れたなぞれないインデックスの集合) をビットフィールドで表したもの */
  private forbiddenBitField: [number, number];

  /**
   * なぞっている座標をキー、
   * そのインデックス周辺で次に候補としてなぞれるインデックス候補の集合を値、
   * としたマッピング。
   * キーをリストアップすることで traceCoords が求まり、
   * 値をまとめあげることで、次の全候補が求まる。
   * 各値どうしは排他的で、全候補とforbiddenBitFieldも必ず排他的な関係になる。
   */
  private traceCoordMap: Map<PuyoCoord, Set<PuyoCoord>>;

  constructor(
    forbiddenBitField: [number, number],
    traceCoordMap: ReadonlyMap<PuyoCoord, ReadonlySet<PuyoCoord>>
  ) {
    this.forbiddenBitField = [...forbiddenBitField];
    this.traceCoordMap = new Map(
      [...traceCoordMap.entries()].map(([key, value]) => {
        return [key, new Set(value)];
      })
    );
  }

  /**
   * ステートを複製する。
   * @param state
   * @returns
   */
  static clone(state: SolutionState): SolutionState {
    return new SolutionState(state.forbiddenBitField, state.traceCoordMap);
  }

  /** なぞり座標リストを取得する */
  getTraceCoords(): PuyoCoord[] {
    return [...this.traceCoordMap.keys()];
  }

  /** 次のなぞり候補座標を列挙する */
  *enumerateCandidates() {
    for (const candidateSet of this.traceCoordMap.values()) {
      for (const coord of candidateSet) {
        yield coord;
      }
    }
  }

  /**
   * なぞり座標を追加する。
   * @param coord
   * @returns 追加できれば true、そうでなければ false
   */
  addTraceCoord(coord: PuyoCoord): void {
    // 新しい座標周りの候補を求める
    const newCandidateSet = new Set(
      PuyoCoord.adjacentPuyoCoords(coord).filter((c) => {
        if (bitFieldHasIndex(this.forbiddenBitField, c.index)) {
          return false;
        }
        for (const candidateSet of this.traceCoordMap.values()) {
          if (candidateSet.has(c)) {
            return false;
          }
        }
        return true;
      })
    );

    const coordIndex = coord.index;

    // 追加する座標が候補になっていた座標、
    // それより前のなぞり座標、
    // 禁止インデックス集合に関して更新をかける。
    const traceCoords = [...this.traceCoordMap.keys()];
    for (let k = 0; k < traceCoords.length; k++) {
      const keyCoord = traceCoords[k];
      const candidateSet = this.traceCoordMap.get(keyCoord)!;

      if (candidateSet.has(coord)) {
        // 追加する座標が候補になっていたなぞり座標において
        // 追加する座標よりindexが若いものは候補から外す (既に探索済みのはずなので)

        for (let kk = 0; kk < k; kk++) {
          const kc = traceCoords[kk];
          for (const forbiddenCoord of this.traceCoordMap.get(kc)!) {
            bitFieldAddIndex(this.forbiddenBitField, forbiddenCoord.index);
          }
          this.traceCoordMap.set(kc, new Set([]));
        }

        this.traceCoordMap.set(
          keyCoord,
          new Set([...candidateSet.keys()].filter((c) => c.index > coordIndex))
        );

        const moreForbiddenCoordList = [...candidateSet.keys()].filter(
          (c) => c.index <= coordIndex
        );

        for (const forbiddenCoord of moreForbiddenCoordList) {
          bitFieldAddIndex(this.forbiddenBitField, forbiddenCoord.index);
        }

        break;
      }
    }

    // 新しくインデックスを追加する
    this.traceCoordMap.set(coord, newCandidateSet);
    bitFieldAddIndex(this.forbiddenBitField, coordIndex);
  }

  /**
   * 追加可能の座標かどうか調べる。
   * @param coord
   * @param maxTraceNum
   * @returns 追加可能であれば true、そうでなければ false
   */
  checkIfAddableCoord(coord: PuyoCoord, maxTraceNum: number): boolean {
    if (this.traceCoordMap.size + 1 > maxTraceNum) {
      return false;
    }

    const coordIndex = coord.index;

    if (bitFieldHasIndex(this.forbiddenBitField, coordIndex)) {
      return false;
    }

    if (this.traceCoordMap.size === 0) {
      return true;
    }

    for (const candidateSet of this.traceCoordMap.values()) {
      if (candidateSet.has(coord)) {
        return true;
      }
    }

    return false;
  }
}

/** solve2() 時のキャリー */
export interface SolutionCarry {
  solutionNums: number;
  optimalSolution: SolutionResult | undefined;
}

export enum SolutionMethod {
  solve2 = 'solve2',
  solve3 = 'solve3'
}
