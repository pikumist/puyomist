import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import PuyoBoard from '@/components/board/PuyoBoard';
import BoardEditPopover from '@/components/layout/BoardEditPopover';
import { Button } from '@/components/ui/button';
import { parseBoardCsv, toBoardCsv } from '@/logics/board-csv';
import { usePuyoAppState, usePuyoAppStore } from '@/store/puyoAppStore';
import {
  type CapsItem,
  deleteItem,
  fetchCaps,
  fetchCsv,
  pngUrl,
  postCsv,
  resolveServerAndDir
} from './api';

const { server, dir } = resolveServerAndDir();

/**
 * Minimal labeling shell for puyoquess draft-CSV correction.
 *
 * Reuses the existing board rendering / edit UI (`PuyoBoard`,
 * `BoardEditPopover`) and the existing CSV <-> Board logics
 * (`parseBoardCsv`, `toBoardCsv`) and store loading action
 * (`boardDetectedAndSolve`) as-is. Deliberately does NOT render any
 * chain/solver/exploration/animation panel, and never touches
 * `logics/board-detection` (screenshot->board inference stays puyoquess-only).
 */
const LabelerApp: React.FC = () => {
  const { isBoardEditing, boardEditMode, simulationData } = usePuyoAppState();

  const [items, setItems] = useState<CapsItem[]>([]);
  const [index, setIndex] = useState(0);
  const [listError, setListError] = useState<string>();
  const [itemError, setItemError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();

  const loadCaps = useCallback(async () => {
    try {
      const res = await fetchCaps(server, dir);
      setItems(res.items);
      setListError(undefined);
    } catch (e) {
      setListError(
        `一覧を取得できませんでした。puyoquess の label_server (${server}) を起動してください。詳細: ${
          (e as Error).message
        }`
      );
    }
  }, []);

  useEffect(() => {
    loadCaps();
  }, [loadCaps]);

  // Finished (saved/GT-confirmed) captures are hidden by default so the queue
  // shows only what still needs work. `showDone` reveals them for re-editing.
  const visibleItems = useMemo(
    () => (showDone ? items : items.filter((it) => !it.done)),
    [items, showDone]
  );
  const doneCount = useMemo(() => items.filter((it) => it.done).length, [items]);

  // Keep the cursor in range as the visible list shrinks (save marks an item
  // done and removes it, delete drops it, the toggle changes the set).
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(visibleItems.length - 1, 0)));
  }, [visibleItems.length]);

  const current = visibleItems[index] as CapsItem | undefined;

  useEffect(() => {
    if (!current) {
      return;
    }
    let cancelled = false;
    setStatusMessage(undefined);
    setItemError(undefined);
    setLoaded(false);

    // Clear the board up-front so a failed/pending load can never leave the
    // PREVIOUS item's board visible and saveable to this stem. `boardDetected`
    // (unlike `boardDetectedAndSolve`) sets the board WITHOUT starting the
    // solver — the labeler never solves, so no stale optimal trace can bleed
    // across items.
    const store = usePuyoAppStore.getState();
    store.boardDetected({ error: undefined, board: undefined });
    store.solutionResetButtonClicked();

    (async () => {
      try {
        const csvText = await fetchCsv(server, dir, current.stem);
        if (cancelled) {
          return;
        }
        const errorOrBoard = parseBoardCsv(csvText);
        if (cancelled) {
          return;
        }
        if (typeof errorOrBoard === 'string') {
          setItemError(`CSVの解析に失敗しました: ${errorOrBoard}`);
        } else {
          store.boardDetected({ error: undefined, board: errorOrBoard });
          store.solutionResetButtonClicked();
          setLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setItemError((e as Error).message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () =>
    setIndex((i) => Math.min(visibleItems.length - 1, i + 1));

  const handleSave = async () => {
    if (!current || !loaded) {
      return;
    }
    setSaving(true);
    setStatusMessage(undefined);
    try {
      const csvText = toBoardCsv(simulationData);
      await postCsv(server, dir, current.stem, csvText);
      // Saving confirms the board (GT) -> mark it done. Unless "完了も表示" is
      // on, that removes it from the visible queue and the next item slides
      // into this slot automatically (so no explicit goNext).
      setItems((prev) =>
        prev.map((it) =>
          it.stem === current.stem ? { ...it, hasCsv: true, done: true } : it
        )
      );
      setStatusMessage(`保存しました: ${current.stem}`);
      if (showDone) {
        goNext();
      }
    } catch (e) {
      setStatusMessage(`保存に失敗しました: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!current) {
      return;
    }
    if (
      !window.confirm(
        `${current.stem} を削除します（画像と下書きCSVを完全に削除）。よろしいですか？`
      )
    ) {
      return;
    }
    setDeleting(true);
    setStatusMessage(undefined);
    try {
      await deleteItem(server, dir, current.stem);
      // Drop it from the list; keeping the same index shows the item that
      // shifted up into this slot (the clamp effect handles the tail).
      setItems((prev) => prev.filter((it) => it.stem !== current.stem));
      setStatusMessage(`削除しました: ${current.stem}`);
    } catch (e) {
      setStatusMessage(`削除に失敗しました: ${(e as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  const progressLabel = useMemo(
    () =>
      visibleItems.length > 0 ? `${index + 1} / ${visibleItems.length}` : '0 / 0',
    [index, visibleItems.length]
  );

  if (listError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="mb-2 text-lg font-bold">puyomist labeler</h1>
        <p className="text-destructive">{listError}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">puyomist labeler</h1>
        <span className="text-muted-foreground text-sm">
          dir: {dir} ({progressLabel})
          {!showDone && doneCount > 0 ? `・完了 ${doneCount} 件は非表示` : ''}
        </span>
        <label className="text-muted-foreground flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          完了も表示
        </label>
        <span className="text-muted-foreground text-sm">{server}</span>
      </header>

      {!current ? (
        <div className="text-muted-foreground">
          {items.length === 0
            ? `対象データがありません（${dir} に画像がないか、サーバから空の一覧が返っています）。`
            : `未完了の項目はありません（完了 ${doneCount} 件）。「完了も表示」で再表示できます。`}
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm">
              {current.stem}
              {current.done ? '（完了）' : current.hasCsv ? '' : '（下書き未保存）'}
            </div>
            <img
              src={pngUrl(server, dir, current.stem)}
              alt={current.stem}
              className="max-w-xs rounded-md border border-border"
            />
          </div>

          <div className="board-stack flex flex-col items-center gap-2">
            <PuyoBoard className="board-fluid" />
            <BoardEditPopover
              isBoardEditing={isBoardEditing}
              boardEditMode={boardEditMode}
            />
          </div>
        </div>
      )}

      {itemError ? <div className="text-destructive">{itemError}</div> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={goPrev} disabled={index <= 0}>
          ← 前
        </Button>
        <Button
          onClick={handleSave}
          disabled={!current || saving || deleting || !loaded}
        >
          保存
        </Button>
        <Button
          variant="outline"
          onClick={goNext}
          disabled={index >= visibleItems.length - 1}
        >
          次 →
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={!current || saving || deleting}
        >
          削除
        </Button>
        {statusMessage ? <span className="text-sm">{statusMessage}</span> : null}
      </div>
    </div>
  );
};

export default LabelerApp;
