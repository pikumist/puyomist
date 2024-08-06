/** ミリ秒を時間のスケールに応じて単位を付けて表示する */
export const formatDuration = (ms: number): string => {
  let seconds = Math.floor(ms / 1000);
  const milliseconds = ms - seconds * 1000;
  let minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;

  if (hours) {
    return `${hours}h${String(minutes).padStart(2, '0')}m${String(
      seconds
    ).padStart(2, '0')}s`;
  }
  if (minutes) {
    return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}.${String(milliseconds).padStart(3, '0')}s`;
};
