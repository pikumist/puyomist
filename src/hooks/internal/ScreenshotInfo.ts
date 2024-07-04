import type { FileInfo } from '../../../isomorphic/FileInfo';

/** スクリーンショット情報 */
export interface ScreenshotInfo extends FileInfo {
  blobUrl: string;
}
