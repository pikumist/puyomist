import type { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { PencilIcon, XIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { pastelClassForAttr } from '@/components/controls/puyoColorClass';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { PuyoIcon } from '@/components/ui/puyo-icon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  type BoardEditMode,
  HowToEditBoard,
  howToEditBoardDescriptionMap
} from '@/logics/BoardEditMode';
import { type PuyoType, puyoTypeMap } from '@/logics/PuyoType';
import {
  boardEditCustomTypeChanged,
  boardEditingEnded,
  boardEditingStarted,
  howToEditBoardChanged
} from '@/store/puyoAppStore';

interface IProps {
  /** Whether board editing is active. */
  isBoardEditing: boolean;
  /** Board edit mode. */
  boardEditMode: BoardEditMode | undefined;
}

const emptyKey = 'empty';

/** Board-edit popover (mode select + custom puyo picker + end). */
const BoardEditPopover: React.FC<IProps> = (props) => {
  const { isBoardEditing, boardEditMode } = props;
  const [open, setOpen] = useState(false);

  // 盤面と横並びで表示できる広い画面でのみ、Issue #81 の
  // 「開いたまま編集」挙動を有効化する。狭い画面(モバイル)では
  // ポップアップが盤面に被さるため、従来どおり閉じられるようにする。
  const isWideScreen = useMediaQuery('(min-width: 768px)');

  const handleOpenChange = (
    nextOpen: boolean,
    eventDetails: PopoverPrimitive.Root.ChangeEventDetails
  ) => {
    if (nextOpen) {
      // 開いた時点で編集モードに入る(「編集開始」ボタンは不要)。
      boardEditingStarted();
      setOpen(true);
      return;
    }
    if (isWideScreen) {
      // 広い画面では誤クローズを防ぎ、× ボタン(close-press)か ESC
      // (escape-key)でのみ閉じる。外側クリック・フォーカス外れ・
      // トリガー再押下などは無視する(Issue #81)。
      if (
        eventDetails.reason !== 'close-press' &&
        eventDetails.reason !== 'escape-key'
      ) {
        eventDetails.cancel();
        return;
      }
      // 閉じるときは編集モードも終了する。
      boardEditingEnded();
    }
    setOpen(false);
  };

  const howToEditItems = [...howToEditBoardDescriptionMap] as ReadonlyArray<
    readonly [HowToEditBoard, string]
  >;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant={isBoardEditing ? 'default' : 'outline'}
            size="icon"
            aria-label="盤面を編集"
          />
        }
      >
        <PencilIcon />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">盤面編集</div>
            <PopoverClose
              aria-label="閉じる"
              className="rounded-md p-1 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" />
            </PopoverClose>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">モード:</span>
            <EnumSelect<HowToEditBoard>
              ariaLabel="編集モードの選択"
              triggerClassName="w-52"
              value={boardEditMode?.howToEdit ?? HowToEditBoard.ClearEnhance}
              items={howToEditItems}
              colorClassFor={(v) => pastelClassForAttr(v - 3)}
              onValueChange={(v) => {
                howToEditBoardChanged(v);
                // モード選択で編集モードに入る(Issue #81)。
                boardEditingStarted();
              }}
            />
          </div>

          {boardEditMode?.howToEdit === HowToEditBoard.ToCustomType ? (
            <RadioGroup
              className="grid grid-cols-4 gap-3"
              value={
                boardEditMode?.customType
                  ? String(boardEditMode.customType)
                  : emptyKey
              }
              onValueChange={(value: string) => {
                boardEditCustomTypeChanged(
                  value === emptyKey
                    ? undefined
                    : (Number.parseInt(value, 10) as PuyoType)
                );
                // 変換先ぷよの選択でも編集モードに入る(Issue #81)。
                boardEditingStarted();
              }}
            >
              {[...puyoTypeMap.entries(), [emptyKey, '空'] as const].map(
                (entry) => {
                  const [type] = entry;
                  return (
                    <Label key={String(type)} className="gap-1">
                      <RadioGroupItem value={String(type)} />
                      {type !== emptyKey ? (
                        <span className="inline-flex rounded-md bg-muted p-0.5">
                          <PuyoIcon type={type as PuyoType} size={26} />
                        </span>
                      ) : (
                        <span className="text-sm">空</span>
                      )}
                    </Label>
                  );
                }
              )}
            </RadioGroup>
          ) : null}

          <div className="flex justify-end">
            {/* 編集終了は編集モードを抜けてポップアップも閉じる(画面幅を問わず。
                制御 state を直接閉じるため handleOpenChange の抑止を通らない)。 */}
            <Button
              size="sm"
              disabled={!isBoardEditing}
              onClick={() => {
                boardEditingEnded();
                setOpen(false);
              }}
            >
              編集終了
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default BoardEditPopover;
