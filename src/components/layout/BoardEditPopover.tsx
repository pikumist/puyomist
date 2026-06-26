import { PencilIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { pastelClassForAttr } from '@/components/controls/puyoColorClass';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
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

/** Board-edit popover (mode select + custom puyo picker + start/end). */
const BoardEditPopover: React.FC<IProps> = (props) => {
  const { isBoardEditing, boardEditMode } = props;
  const [open, setOpen] = useState(false);

  const howToEditItems = [...howToEditBoardDescriptionMap] as ReadonlyArray<
    readonly [HowToEditBoard, string]
  >;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <div className="font-medium">盤面編集</div>
          <div className="flex items-center gap-2">
            <span className="text-sm">モード:</span>
            <EnumSelect<HowToEditBoard>
              ariaLabel="編集モードの選択"
              triggerClassName="w-52"
              value={boardEditMode?.howToEdit ?? HowToEditBoard.ClearEnhance}
              items={howToEditItems}
              colorClassFor={(v) => pastelClassForAttr(v - 3)}
              onValueChange={(v) => howToEditBoardChanged(v)}
            />
          </div>

          {boardEditMode?.howToEdit === HowToEditBoard.ToCustomType ? (
            <RadioGroup
              className="grid grid-cols-4 gap-2"
              value={
                boardEditMode?.customType
                  ? String(boardEditMode.customType)
                  : emptyKey
              }
              onValueChange={(value: string) =>
                boardEditCustomTypeChanged(
                  value === emptyKey
                    ? undefined
                    : (Number.parseInt(value, 10) as PuyoType)
                )
              }
            >
              {[...puyoTypeMap.entries(), [emptyKey, '空'] as const].map(
                (entry) => {
                  const [type] = entry;
                  return (
                    <Label key={String(type)} className="gap-1">
                      <RadioGroupItem value={String(type)} />
                      {type !== emptyKey ? (
                        <PuyoIcon type={type as PuyoType} size={20} />
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
            {isBoardEditing ? (
              <Button
                size="sm"
                onClick={() => {
                  boardEditingEnded();
                  setOpen(false);
                }}
              >
                編集終了
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  boardEditingStarted();
                  setOpen(false);
                }}
              >
                編集開始
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default BoardEditPopover;
