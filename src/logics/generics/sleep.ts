/**
 * 指定のミリ秒スリープする
 * @param ms ミリ秒
 * @returns
 */
export const sleep = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
