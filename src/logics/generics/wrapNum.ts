/**
 * 数値を範囲内にラップする。角度など数値に周期性があるものに使う。
 * @param x 数値
 * @param range 最小値と最大値
 * @param includeMax xが最大値のときにそのまま最大値として返すか(true)最小値として返すか(false)。省略時はfalse
 * @returns ラップされた数値
 */
export const wrapNum = (
  x: number,
  range: [number, number],
  includeMax?: boolean
) => {
  const max = range[1];
  const min = range[0];
  const d = max - min;

  return x === max && includeMax ? x : ((((x - min) % d) + d) % d) + min;
};
