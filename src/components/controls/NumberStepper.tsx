import { MinusIcon, PlusIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NumberStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Number of decimal places to display / snap to (default derived from step). */
  decimals?: number;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
}

function decimalsFromStep(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/**
 * Numeric stepper input replacing Chakra's `NumberInput`. Built from the
 * shadcn `Input` + two `Button`s so it inherits design tokens and 44px-ish
 * touch targets.
 *
 * The text field keeps a free-form `draft` while focused so the user can type
 * intermediate values (e.g. "7." on the way to "7.0") without the value being
 * clamped/snapped on every keystroke. Clamp + snap + `onChange` only run when
 * the field is committed (blur or Enter). The +/- buttons commit immediately.
 */
export function NumberStepper({
  value,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled,
  onChange,
  decimals,
  ariaLabel,
  className,
  inputClassName
}: NumberStepperProps) {
  const id = useId();
  const places = decimals ?? decimalsFromStep(step);

  const format = (v: number) => (places > 0 ? v.toFixed(places) : String(v));
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) =>
    places > 0 ? Number(v.toFixed(places)) : Math.round(v);

  const [draft, setDraft] = useState(() => format(value));
  const editingRef = useRef(false);

  // Reflect external value changes (buttons, store resets) into the field while
  // the user isn't actively editing it.
  useEffect(() => {
    if (!editingRef.current) {
      setDraft(places > 0 ? value.toFixed(places) : String(value));
    }
  }, [value, places]);

  const commit = (text: string) => {
    const next = Number.parseFloat(text);
    if (Number.isNaN(next)) {
      setDraft(format(value)); // revert empty / invalid input
      return;
    }
    const snapped = snap(clamp(next));
    onChange(snapped);
    setDraft(format(snapped));
  };

  const stepBy = (delta: number) => {
    const snapped = snap(clamp(value + delta));
    onChange(snapped);
    setDraft(format(snapped));
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value <= min}
        aria-label={ariaLabel ? `${ariaLabel}を減らす` : 'decrement'}
        onClick={() => stepBy(-step)}
      >
        <MinusIcon />
      </Button>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn('w-16 text-center', inputClassName)}
        value={draft}
        onFocus={() => {
          editingRef.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          editingRef.current = false;
          commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(draft);
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(format(value));
            e.currentTarget.blur();
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value >= max}
        aria-label={ariaLabel ? `${ariaLabel}を増やす` : 'increment'}
        onClick={() => stepBy(step)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

export default NumberStepper;
