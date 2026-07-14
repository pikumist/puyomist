export const bridgeImageToBlobUrl = (img: {
  mime: string;
  base64: string;
}) => {
  const str = window.atob(img.base64);
  const len = str.length;
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: img.mime });
  const url = URL.createObjectURL(blob);

  return url;
};
