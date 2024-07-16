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

/** なぞり消しモードと説明のマップ */
export const traceModeDescriptionMap: ReadonlyMap<TraceMode, string> = new Map([
  [TraceMode.Normal, 'ぷよを消す'],
  [TraceMode.ToRed, '赤ぷよに変える'],
  [TraceMode.ToBlue, '青ぷよに変える'],
  [TraceMode.ToGreen, '緑ぷよに変える'],
  [TraceMode.ToYellow, '黄ぷよに変える'],
  [TraceMode.ToPurple, '紫ぷよに変える']
]);
