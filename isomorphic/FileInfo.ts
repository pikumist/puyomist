/** ファイル情報 */
export interface FileInfo {
  /** ファイルのパス */
  filePath: string;
  /** ファイル名 */
  fileName: string;
  /** ファイルのMIME */
  mime: string;
  /** ファイルの中身のBase64エンコーディング */
  contentAsBase64: string;
  /** ファイルサイズ (bytes) */
  size?: number;
}
