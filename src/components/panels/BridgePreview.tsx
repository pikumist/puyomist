import type React from 'react';

import { cn } from '@/lib/utils';
import { usePuyoAppState } from '@/store/puyoAppStore';

/**
 * ボードブリッジから受け取ったプレビュー画像を画面左下に小さく表示する。
 * `bridgePreview` が未設定の間は何も描画しない。
 */
const BridgePreview: React.FC = () => {
  const { bridgePreview } = usePuyoAppState();

  if (!bridgePreview) {
    return null;
  }

  return (
    <img
      src={bridgePreview.blobUrl}
      alt="bridge preview"
      className={cn(
        'pointer-events-none fixed bottom-2 left-2 z-40',
        'max-w-[160px] rounded border border-border shadow'
      )}
    />
  );
};

export default BridgePreview;
