/** 盤面ブリッジからのメッセージ (Python board_bridge.py が送信) */
export interface BoardMessage {
  /** メッセージ種別 */
  type: 'board';
  /** 大連鎖チャンスモードかどうか */
  mode: 'NORMAL' | 'CHANCE';
  /** 盤面CSV (puyoquess形式) */
  csv: string;
  /** プレビュー画像 (任意) */
  image?: {
    /** 画像のMIME */
    mime: string;
    /** 画像の中身のBase64エンコーディング */
    base64: string;
  };
}

/** ブリッジ経由で受け取るメッセージ */
export type BridgeMessage = BoardMessage;
