/**
 * Client for the puyoquess label server (separate project, contract fixed):
 * - GET  /api/caps?dir=<dir>            -> { dir, items: [{ stem, img, hasCsv, done }] }
 *     done = the board has been saved/confirmed (GT) and its marker is at least
 *     as new as the CSV (a regenerated draft clears it).
 * - GET  /api/png/<dir>/<stem>.PNG      -> image/png
 * - GET    /api/csv/<dir>/<stem>.csv    -> text/csv (draft board)
 * - POST   /api/csv/<dir>/<stem>.csv    -> { ok: true } | 400 { error }
 * - DELETE /api/item/<dir>/<stem>       -> { ok: true, deleted: [...] } | 404
 */

export interface CapsItem {
  stem: string;
  img: string;
  hasCsv: boolean;
  /** True once the board has been confirmed/saved (GT) via the labeler. */
  done: boolean;
}

export interface CapsResponse {
  dir: string;
  items: CapsItem[];
}

export const DEFAULT_SERVER = 'http://127.0.0.1:8770';
export const DEFAULT_DIR = 'iphone_caps';

/** Resolves the label-server base URL and target dir from the query string. */
export const resolveServerAndDir = (): { server: string; dir: string } => {
  const params = new URLSearchParams(window.location.search);
  const rawServer = params.get('server') ?? DEFAULT_SERVER;
  // Strip trailing slashes so URL builders don't produce `host//api/...`.
  const server = rawServer.replace(/\/+$/, '');
  const dir = params.get('dir') ?? DEFAULT_DIR;
  return { server, dir };
};

export const pngUrl = (server: string, dir: string, stem: string): string =>
  `${server}/api/png/${encodeURIComponent(dir)}/${encodeURIComponent(stem)}.PNG`;

export const csvUrl = (server: string, dir: string, stem: string): string =>
  `${server}/api/csv/${encodeURIComponent(dir)}/${encodeURIComponent(stem)}.csv`;

export const fetchCaps = async (
  server: string,
  dir: string
): Promise<CapsResponse> => {
  const res = await fetch(`${server}/api/caps?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) {
    throw new Error(`一覧取得に失敗しました (HTTP ${res.status})`);
  }
  return (await res.json()) as CapsResponse;
};

export const fetchCsv = async (
  server: string,
  dir: string,
  stem: string
): Promise<string> => {
  const res = await fetch(csvUrl(server, dir, stem));
  if (!res.ok) {
    throw new Error(`下書きCSVの取得に失敗しました (HTTP ${res.status})`);
  }
  return await res.text();
};

export const deleteItem = async (
  server: string,
  dir: string,
  stem: string
): Promise<void> => {
  const res = await fetch(
    `${server}/api/item/${encodeURIComponent(dir)}/${encodeURIComponent(stem)}`,
    { method: 'DELETE' }
  );
  if (res.ok) {
    return;
  }
  let message = `削除に失敗しました (HTTP ${res.status})`;
  try {
    const json = (await res.json()) as { error?: string };
    if (json?.error) {
      message = json.error;
    }
  } catch {
    // ignore: body wasn't JSON, keep the generic message
  }
  throw new Error(message);
};

export const postCsv = async (
  server: string,
  dir: string,
  stem: string,
  csvText: string
): Promise<void> => {
  const res = await fetch(csvUrl(server, dir, stem), {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText
  });
  if (res.ok) {
    return;
  }
  let message = `保存に失敗しました (HTTP ${res.status})`;
  try {
    const json = (await res.json()) as { error?: string };
    if (json?.error) {
      message = json.error;
    }
  } catch {
    // ignore: body wasn't JSON, keep the generic message
  }
  throw new Error(message);
};
