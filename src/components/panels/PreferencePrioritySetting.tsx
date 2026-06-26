import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  type PreferenceKind,
  getDerivativePreferenceList,
  isValuePreference,
  preferenceKindDescriptionMap
} from '@/logics/ExplorationTarget';
import {
  explorationPreferenceAdded,
  explorationPreferencePrioritiesChanged,
  explorationPreferenceReplaced
} from '@/store/puyoAppStore';
import SortableList from './sortable/SortableList';

interface ItemData {
  id: PreferenceKind;
  index: number;
  description: string | undefined;
}

/** Preference priority setting (add / reorder / change preference). */
const PreferencePrioritySetting: React.FC<{
  preferencePriorities: PreferenceKind[];
}> = (props) => {
  const { preferencePriorities } = props;

  const items: ItemData[] = useMemo(
    () =>
      preferencePriorities.map((pref, i) => ({
        id: pref,
        index: i + 1,
        description: preferenceKindDescriptionMap.get(pref)
      })),
    [preferencePriorities]
  );

  const addablePreferences = useMemo(() => {
    const forbiddenSet = new Set(preferencePriorities.map((pref) => pref % 10));
    return [...preferenceKindDescriptionMap.keys()].filter(
      (pref) => pref < 10 && !forbiddenSet.has(pref % 10)
    );
  }, [preferencePriorities]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">優先度</span>
        {addablePreferences.length > 0 ? (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="優先度を追加"
                />
              }
            >
              <PlusIcon />
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" showArrow={false}>
              <div className="flex flex-col">
                {addablePreferences.map((pref) => (
                  <Button
                    key={pref}
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => explorationPreferenceAdded(pref)}
                  >
                    {preferenceKindDescriptionMap.get(pref)}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      <SortableList<ItemData>
        items={items}
        onChange={(next) =>
          explorationPreferencePrioritiesChanged(next.map(({ id }) => id))
        }
        renderItem={(item) => {
          const derivatives = getDerivativePreferenceList(item.id);
          return (
            <SortableList.Item id={item.id}>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5',
                  isValuePreference(item.id)
                    ? 'bg-accent-muted'
                    : 'bg-surface-raised'
                )}
              >
                <span className="num text-sm">{item.index}.</span>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-1 py-0"
                      />
                    }
                  >
                    <span className="text-sm">{item.description}</span>
                    <ChevronDownIcon className="size-3.5" />
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" showArrow={false}>
                    <div className="flex flex-col">
                      {derivatives.map((pref) => (
                        <Button
                          key={pref}
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() =>
                            explorationPreferenceReplaced({
                              from: item.id,
                              to: pref
                            })
                          }
                        >
                          {preferenceKindDescriptionMap.get(pref)}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <SortableList.DragHandle className="ml-auto" />
              </div>
            </SortableList.Item>
          );
        }}
      />
    </div>
  );
};

export default PreferencePrioritySetting;
