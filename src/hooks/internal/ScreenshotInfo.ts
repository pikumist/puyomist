/** スクリーンショット情報 */
export interface ScreenshotInfo {
  /** ファイルのパス */
  filePath: string;
  /** ファイル名 */
  fileName: string;
  /** ファイルのMIME */
  mime: string;
  /** ファイルサイズ (bytes) */
  size?: number;
  /** 画像のBlob URL */
  blobUrl: string;
}
