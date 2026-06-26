import { PuyoAttr } from '@/logics/PuyoAttr';

/**
 * 5 色ぷよを表すパステル背景クラス。ドロップダウンの項目とトリガーに付与して
 * どの色かを一目で分かるようにする。
 *
 * - `cn` (twMerge) で base クラスより後に結合され、後勝ちで上書きされる前提。
 * - `hover:` はトリガー、`data-highlighted:` は項目のハイライト用。
 * - `dark:` 変種は、トリガー base の `dark:bg-input/30` 等を上書きするために必要。
 * - 全クラスはリテラルで列挙し、Tailwind のスキャナに確実に拾わせる。
 */
export const pastelColorClass = {
  red: 'bg-red-300 text-red-950 hover:bg-red-400 data-highlighted:bg-red-400 data-highlighted:text-red-950 dark:bg-red-300 dark:text-red-950 dark:hover:bg-red-400 dark:data-highlighted:bg-red-400 dark:data-highlighted:text-red-950',
  blue: 'bg-blue-300 text-blue-950 hover:bg-blue-400 data-highlighted:bg-blue-400 data-highlighted:text-blue-950 dark:bg-blue-300 dark:text-blue-950 dark:hover:bg-blue-400 dark:data-highlighted:bg-blue-400 dark:data-highlighted:text-blue-950',
  green:
    'bg-green-300 text-green-950 hover:bg-green-400 data-highlighted:bg-green-400 data-highlighted:text-green-950 dark:bg-green-300 dark:text-green-950 dark:hover:bg-green-400 dark:data-highlighted:bg-green-400 dark:data-highlighted:text-green-950',
  yellow:
    'bg-yellow-300 text-yellow-950 hover:bg-yellow-400 data-highlighted:bg-yellow-400 data-highlighted:text-yellow-950 dark:bg-yellow-300 dark:text-yellow-950 dark:hover:bg-yellow-400 dark:data-highlighted:bg-yellow-400 dark:data-highlighted:text-yellow-950',
  purple:
    'bg-purple-300 text-purple-950 hover:bg-purple-400 data-highlighted:bg-purple-400 data-highlighted:text-purple-950 dark:bg-purple-300 dark:text-purple-950 dark:hover:bg-purple-400 dark:data-highlighted:bg-purple-400 dark:data-highlighted:text-purple-950'
} as const;

/**
 * ぷよ属性に対応するパステル背景クラスを返す。色ぷよ以外は `undefined`。
 *
 * 各ドロップダウンの値を `PuyoAttr` (1=赤 … 5=紫) に揃えて渡すこと。
 * `TraceMode` はそのまま (ToRed=1 … ToPurple=5) で一致する。
 */
export function pastelClassForAttr(attr: number): string | undefined {
  switch (attr) {
    case PuyoAttr.Red:
      return pastelColorClass.red;
    case PuyoAttr.Blue:
      return pastelColorClass.blue;
    case PuyoAttr.Green:
      return pastelColorClass.green;
    case PuyoAttr.Yellow:
      return pastelColorClass.yellow;
    case PuyoAttr.Purple:
      return pastelColorClass.purple;
    default:
      return undefined;
  }
}

/**
 * ネクストぷよの選択値 (`'red'`, `'yellow+'`, `'random'` 等) に対応する
 * パステル背景クラスを返す。`'+'` は無視し、`'random'` は `undefined`。
 */
export function pastelClassForNextSelection(value: string): string | undefined {
  const base = value.endsWith('+') ? value.slice(0, -1) : value;
  return pastelColorClass[base as keyof typeof pastelColorClass];
}
