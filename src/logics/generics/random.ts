/**
 * 配列をシャッフルする
 * https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
 * @param array
 */
export function shuffle<T>(array: T[]): void {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex]
    ];
  }
}

/**
 * 配列からランダムに要素を選択する
 * @param array
 */
export function choice<T>(array: T[]): T {
  return array[Math.floor(array.length * Math.random())];
}
