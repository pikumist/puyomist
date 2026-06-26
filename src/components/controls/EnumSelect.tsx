import type * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface EnumSelectProps<T> {
  /** Currently selected value. */
  value: T;
  /** Called with the newly selected value. */
  onValueChange: (value: T) => void;
  /** [value, label] pairs rendered as options. */
  items: ReadonlyArray<readonly [T, React.ReactNode]>;
  /** Accessible name for the trigger. */
  ariaLabel?: string;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  disabled?: boolean;
  /** Width / extra classes for the trigger. */
  triggerClassName?: string;
  /**
   * Optional per-value class (e.g. a pastel background) applied to each option
   * in the popup and to the trigger for the currently selected value.
   */
  colorClassFor?: (value: T) => string | undefined;
}

/**
 * Thin wrapper around the shadcn `Select` for the common
 * "pick one of an enum" pattern. Replaces Chakra's native `<Select>`.
 *
 * The trigger label is resolved from `items` so it stays correct even while
 * the options popup (a portal) is unmounted.
 */
export function EnumSelect<T>({
  value,
  onValueChange,
  items,
  ariaLabel,
  placeholder,
  disabled,
  triggerClassName,
  colorClassFor
}: EnumSelectProps<T>) {
  const labelFor = (val: T): React.ReactNode => {
    for (const [v, label] of items) {
      if (v === val) {
        return label;
      }
    }
    return placeholder;
  };

  return (
    <Select<T>
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(triggerClassName, colorClassFor?.(value))}
      >
        <SelectValue placeholder={placeholder}>
          {(val: T) => labelFor(val)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map(([v, label]) => (
          <SelectItem key={String(v)} value={v} className={colorClassFor?.(v)}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default EnumSelect;
