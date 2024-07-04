import type { FileInfo } from '../../../isomorphic/FileInfo';

export const fileInfoToBlobUrl = (fileInfo: FileInfo) => {
  const str = window.atob(fileInfo.contentAsBase64);
  const len = str.length;
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: fileInfo.mime });
  const url = URL.createObjectURL(blob);

  return url;
};
