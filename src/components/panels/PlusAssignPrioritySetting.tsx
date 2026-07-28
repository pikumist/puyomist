import { useMemo } from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { cn } from '@/lib/utils';
import {
  type ColoredPuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '@/logics/PuyoAttr';
import {
  PlusPreferenceKind,
  plusPreferenceKindDescriptionMap
} from '@/logics/plus-assign';
import { plusAssignSettingsChanged } from '@/store/puyoAppStore';
import SortableList from './sortable/SortableList';

interface ItemData {
  id: PlusPreferenceKind;
  index: number;
  description: string | undefined;
}

interface PlusAssignPrioritySettingProps {
  priorities: PlusPreferenceKind[];
  color: ColoredPuyoAttr;
}

/**
 * プラス付与案の優先度設定。
 *
 * 探索の優先度と同じ辞書式で、上のものから順に比べて同点なら次で優劣を付ける。
 * こちらは種類の増減が無く並べ替えるだけなので、追加/差し替えのポップオーバーは持たない。
 */
const PlusAssignPrioritySetting: React.FC<PlusAssignPrioritySettingProps> = (
  props
) => {
  const { priorities, color } = props;

  const items: ItemData[] = useMemo(
    () =>
      priorities.map((pref, i) => ({
        id: pref,
        index: i + 1,
        description: plusPreferenceKindDescriptionMap.get(pref)
      })),
    [priorities]
  );

  return (
    <div>
      {/* 見出しとリストが詰まって見えるので、間を1段 (0.25rem) 空ける */}
      <span className="mb-1 block text-sm font-medium text-muted-foreground">
        優先度
      </span>
      <SortableList<ItemData>
        items={items}
        onChange={(next) =>
          plusAssignSettingsChanged({ priorities: next.map(({ id }) => id) })
        }
        renderItem={(item) => (
          <SortableList.Item id={item.id}>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-2.5 py-1.5',
                item.id === PlusPreferenceKind.BiggerValue
                  ? 'bg-accent-muted'
                  : 'bg-surface-raised'
              )}
            >
              <span className="num text-sm">{item.index}.</span>
              <span className="text-sm">{item.description}</span>
              {item.id === PlusPreferenceKind.ColoredPuyo ? (
                <EnumSelect<ColoredPuyoAttr>
                  ariaLabel="優先する色"
                  triggerClassName="h-7 py-0"
                  value={color}
                  items={coloredPuyoAttrList.map(
                    (attr) => [attr, getPuyoAttrName(attr)] as const
                  )}
                  onValueChange={(attr) =>
                    plusAssignSettingsChanged({ color: attr })
                  }
                />
              ) : null}
              <SortableList.DragHandle className="ml-auto" />
            </div>
          </SortableList.Item>
        )}
      />
    </div>
  );
};

export default PlusAssignPrioritySetting;
