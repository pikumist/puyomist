/** なぞり消しのモード */
export enum TraceMode {
  /** 通常。なぞったぷよを消す。 */
  Normal = 0,
  /** なぞったぷよを赤ぷよに変える。 */
  ToRed = 1,
  /** なぞったぷよを青ぷよに変える。 */
  ToBlue = 2,
  /** なぞったぷよを緑ぷよに変える。 */
  ToGreen = 3,
  /** なぞったぷよを青ぷよに変える。 */
  ToYellow = 4,
  /** なぞったぷよを紫ぷよに変える。 */
  ToPurple = 5
}

export const traceModeMap: ReadonlyMap<TraceMode, string> = new Map([
  [TraceMode.Normal, 'ぷよを消す'],
  [TraceMode.ToRed, '赤ぷよに変える'],
  [TraceMode.ToBlue, '青ぷよに変える'],
  [TraceMode.ToGreen, '緑ぷよに変える'],
  [TraceMode.ToYellow, '黄ぷよに変える'],
  [TraceMode.ToPurple, '紫ぷよに変える']
]);

export const possibleTraceModeList: ReadonlyArray<TraceMode> = [
  ...traceModeMap.keys()
];

/** なぞり消しモードの説明を取得する。 */
export const getTraceModeDescription = (traceMode: TraceMode) =>
  traceModeMap.get(traceMode);
