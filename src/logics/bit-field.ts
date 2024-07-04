/**
 * @module
 * 48マスのフィールドにおいて各ビットを操作するモジュール。
 * javascript のビット演算は 32 ビットなので、number 2つのタプルでフィールドの全ビットを表現できる。
 * タプルはリトルエンディアンで格納するものとする。
 * つまり、
 * bitField[0] は 0-23 のビット列
 * bitField[1] は 24-47 のビット列
 */

/** ある位の中で全てのビットが1の状態 */
export const allBitsOneInPlace = (1 << 24) - 1;

/**
 * インデックスの位置のビットが 1 かどうか。
 * @param bitField 48マスのビットフィールド。bitField[0] は 0-23 のビット列。bitField[1] は 24-47 のビット列。
 * @param index インデックス
 * @returns
 */
export const bitFieldHasIndex = (
  bitField: readonly [number, number],
  index: number
): boolean => {
  const place = ~~(index / 24);
  const pos = index - place * 24;

  return Boolean(bitField[place] & (1 << pos));
};

/**
 * インデックスの位置のビットを 1 にする。
 * @param bitField 48マスのビットフィールド。bitField[0] は 0-23 のビット列。bitField[1] は 24-47 のビット列。
 * @param index インデックス
 * @returns
 */
export const bitFieldAddIndex = (
  bitField: [number, number],
  index: number
): void => {
  const place = ~~(index / 24);
  const pos = index - place * 24;

  bitField[place] = bitField[place] | (1 << pos);
};

/**
 * インデックスの位置のビットを 0 にする。
 * @param bitField 48マスのビットフィールド。bitField[0] は 0-23 のビット列。bitField[1] は 24-47 のビット列。
 * @param index インデックス
 * @returns
 */
export const bitFieldRemoveIndex = (
  bitField: [number, number],
  index: number
): void => {
  const place = ~~(index / 24);
  const pos = index - place * 24;

  bitField[place] = bitField[place] & ((1 << pos) ^ allBitsOneInPlace);
};

/**
 * index の手前まで 1 で埋めたビットフィールドを作成する。
 * @param index インデックス
 */
export const createfilledOneBitFieldBeforeIndex = (
  index: number
): [number, number] => {
  if (index >= 48) {
    return [allBitsOneInPlace, allBitsOneInPlace];
  }

  const place = ~~(index / 24);
  const pos = index - place * 24;

  const a = (1 << pos) - 1;

  return place === 0 ? [a, 0] : [allBitsOneInPlace, a];
};
