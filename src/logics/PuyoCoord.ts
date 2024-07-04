/** ぷよ座標 */
export class PuyoCoord {
  /** X座標方向の個数 */
  public static readonly XNum = 8;

  /** Y座標方向の個数 */
  public static readonly YNum = 6;

  /** 全座標 */
  private static readonly immutableCoords: ReadonlyArray<
    ReadonlyArray<PuyoCoord>
  > = [
    [
      new PuyoCoord(0, 0),
      new PuyoCoord(1, 0),
      new PuyoCoord(2, 0),
      new PuyoCoord(3, 0),
      new PuyoCoord(4, 0),
      new PuyoCoord(5, 0),
      new PuyoCoord(6, 0),
      new PuyoCoord(7, 0)
    ],
    [
      new PuyoCoord(0, 1),
      new PuyoCoord(1, 1),
      new PuyoCoord(2, 1),
      new PuyoCoord(3, 1),
      new PuyoCoord(4, 1),
      new PuyoCoord(5, 1),
      new PuyoCoord(6, 1),
      new PuyoCoord(7, 1)
    ],
    [
      new PuyoCoord(0, 2),
      new PuyoCoord(1, 2),
      new PuyoCoord(2, 2),
      new PuyoCoord(3, 2),
      new PuyoCoord(4, 2),
      new PuyoCoord(5, 2),
      new PuyoCoord(6, 2),
      new PuyoCoord(7, 2)
    ],
    [
      new PuyoCoord(0, 3),
      new PuyoCoord(1, 3),
      new PuyoCoord(2, 3),
      new PuyoCoord(3, 3),
      new PuyoCoord(4, 3),
      new PuyoCoord(5, 3),
      new PuyoCoord(6, 3),
      new PuyoCoord(7, 3)
    ],
    [
      new PuyoCoord(0, 4),
      new PuyoCoord(1, 4),
      new PuyoCoord(2, 4),
      new PuyoCoord(3, 4),
      new PuyoCoord(4, 4),
      new PuyoCoord(5, 4),
      new PuyoCoord(6, 4),
      new PuyoCoord(7, 4)
    ],
    [
      new PuyoCoord(0, 5),
      new PuyoCoord(1, 5),
      new PuyoCoord(2, 5),
      new PuyoCoord(3, 5),
      new PuyoCoord(4, 5),
      new PuyoCoord(5, 5),
      new PuyoCoord(6, 5),
      new PuyoCoord(7, 5)
    ]
  ];

  /** X座標 (0から7) */
  private _x: number;

  /** Y座標 (0から5) */
  private _y: number;

  /** 直接呼出しは禁止している。staticメソッドを使ってインスタンスを取得すること。 */
  private constructor(x: number, y: number) {
    this._x = x;
    this._y = y;
  }

  /** ぷよのX座標 */
  get x() {
    return this._x;
  }

  /** ぷよのY座標 */
  get y() {
    return this._y;
  }

  /** 一次元配列でのインデックスを返す。 */
  get index(): number {
    return this._y * PuyoCoord.XNum + this._x;
  }

  /**
   * 座標をセルアドレス表記で返す。
   * ```
   * 例:
   * x = 0, y = 0 ⇒ A1
   * x = 1, y = 2 ⇒ B3
   * x = 7, y = 5 ⇒ H6
   * ```
   */
  toCellAddr(): string {
    const col = String.fromCharCode('A'.charCodeAt(0) + this._x);
    const row = String(this._y + 1);
    return `${col}${row}`;
  }

  /**
   * xとyからimmutableなぷよ座標を返す。
   * @param x
   * @param y
   * @returns
   */
  static xyToCoord(x: number, y: number): PuyoCoord | undefined {
    if (!PuyoCoord.isValidXy(x, y)) {
      return;
    }
    return PuyoCoord.immutableCoords[y][x];
  }

  /**
   * cellAddrからimmutableなぷよ座標を返す。
   * @param x
   * @param y
   * @returns
   */
  static cellAddrToCoord(cellAddr: string): PuyoCoord | undefined {
    if (!cellAddr || cellAddr.length !== 2) {
      return;
    }
    const col = cellAddr[0];
    const row = cellAddr[1];
    const x = col.charCodeAt(0) - 'A'.charCodeAt(0);
    const y = Number.parseInt(row, 10) - 1;
    return PuyoCoord.xyToCoord(x, y);
  }

  /**
   * 1次元配列のインデックスからimmutableなぷよ座標を返す。
   * @param index
   * @returns
   */
  static indexToCoord(index: number | number): PuyoCoord | undefined {
    if (!PuyoCoord.isValidIndex(index)) {
      return undefined;
    }

    const x = index % PuyoCoord.XNum;
    const y = (index - x) / PuyoCoord.XNum;

    return PuyoCoord.immutableCoords[y][x];
  }

  /** 範囲内の正しいインデックスであるかどうか。 */
  static isValidIndex(index: number | undefined): index is number {
    return (
      index !== undefined &&
      index >= 0 &&
      index < PuyoCoord.XNum * PuyoCoord.YNum
    );
  }

  /** 範囲内の正しいXYであるかどうか。 */
  static isValidXy(x: number, y: number): boolean {
    return x >= 0 && x < PuyoCoord.XNum && y >= 0 && y < PuyoCoord.YNum;
  }

  /**
   * 指定のぷよ座標から隣接する(斜めもOK)ぷよの座標リストを返す。
   * @param coord
   * @returns
   */
  public static adjacentPuyoCoords(coord: PuyoCoord): PuyoCoord[] {
    const { x, y } = coord;

    const lt = PuyoCoord.xyToCoord(x - 1, y - 1);
    const ct = PuyoCoord.xyToCoord(x, y - 1);
    const rt = PuyoCoord.xyToCoord(x + 1, y - 1);
    const l = PuyoCoord.xyToCoord(x - 1, y);
    const r = PuyoCoord.xyToCoord(x + 1, y);
    const lb = PuyoCoord.xyToCoord(x - 1, y + 1);
    const cb = PuyoCoord.xyToCoord(x, y + 1);
    const rb = PuyoCoord.xyToCoord(x + 1, y + 1);

    return [lt, ct, rt, l, r, lb, cb, rb].filter(Boolean) as PuyoCoord[];
  }
}
