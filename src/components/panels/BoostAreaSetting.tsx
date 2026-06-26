import type React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { boostAreaKeyMap } from '@/logics/BoostArea';
import { boostAreaKeyListChanged } from '@/store/puyoAppStore';

interface IProps {
  /** Selected boost-area keys. */
  boostAreaKeyList: string[];
}

/** Boost-area multi-select setting. */
const BoostAreaSetting: React.FC<IProps> = (props) => {
  const { boostAreaKeyList } = props;

  const toggle = (key: string, checked: boolean) => {
    const set = new Set(boostAreaKeyList);
    if (checked) {
      set.add(key);
    } else {
      set.delete(key);
    }
    boostAreaKeyListChanged([...set]);
  };

  return (
    <div className="my-3 space-y-2">
      <span className="text-sm font-medium text-muted-foreground">
        ブーストエリア
      </span>
      <div className="grid grid-cols-5 gap-1.5">
        {[...boostAreaKeyMap].map(([key, area]) => (
          <Label key={key} className="gap-1.5 text-xs font-normal">
            <Checkbox
              checked={boostAreaKeyList.includes(key)}
              onCheckedChange={(checked) => toggle(key, checked)}
            />
            {area.name}
          </Label>
        ))}
      </div>
    </div>
  );
};

export default BoostAreaSetting;
