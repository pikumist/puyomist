/**
 * @module 集合関連のユーティリティ
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
 */

/**
 * 前者の集合が後者の集合を含んでいるかどうか
 * @param set 集合
 * @param subset サブ集合
 */
export const isSuperset = <T>(
  set: ReadonlySet<T>,
  subset: ReadonlySet<T>
): boolean => {
  for (const elem of subset) {
    if (!set.has(elem)) {
      return false;
    }
  }
  return true;
};

/**
 * 前者の集合が後者の集合に含まれているかどうか
 * @param subset サブ集合
 * @param set 集合
 */
export const isSubset = <T>(
  subset: ReadonlySet<T>,
  set: ReadonlySet<T>
): boolean => {
  return isSuperset(set, subset);
};

/**
 * 前者と後者の[和集合](https://ja.wikipedia.org/wiki/和集合)を求める
 * @param setA
 * @param setB
 */
export const unionSet = <T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>
): Set<T> => {
  const union = new Set(setA);
  for (const elem of setB) {
    union.add(elem);
  }
  return union;
};

/**
 * 前者と後者の[共通集合](https://ja.wikipedia.org/wiki/共通部分_(数学))を求める
 * @param setA 集合A
 * @param setB 集合B
 */
export const intersectionSet = <T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>
): Set<T> => {
  const intersection = new Set<T>();
  for (const item of setB) {
    if (setA.has(item)) {
      intersection.add(item);
    }
  }
  return intersection;
};

/**
 * 前者と後者の[対称差集合](https://ja.wikipedia.org/wiki/対称差)(排他的な集合)を求める
 * @param setA
 * @param setB
 */
export function symmetricDifferenceSet<T>(
  setA: Readonly<Set<T>>,
  setB: Readonly<Set<T>>
): Set<T> {
  const difference = new Set<T>(setA);
  for (const elem of setB) {
    if (difference.has(elem)) {
      difference.delete(elem);
    } else {
      difference.add(elem);
    }
  }
  return difference;
}

/**
 * 前者から後者に属する元を間引いて得られる[差集合](https://ja.wikipedia.org/wiki/差集合)(A - B)を求める
 * @param setA
 * @param setB
 */
export function differenceSet<T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>
): Set<T> {
  const difference = new Set<T>(setA);
  for (const elem of setB) {
    difference.delete(elem);
  }
  return difference;
}

/**
 * 前者と後者の集合の元が完全に等しいかどうか
 * @param setA
 * @param setB
 */
export function eqSet<T>(setA: ReadonlySet<T>, setB: ReadonlySet<T>): boolean {
  if (setA.size !== setB.size) {
    return false;
  }
  for (const elem of setA) {
    if (!setB.has(elem)) {
      return false;
    }
  }
  return true;
}
