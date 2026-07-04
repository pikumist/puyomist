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

const HOLD_INITIAL_DELAY_MS = 400;
const HOLD_REPEAT_INTERVAL_MS = 80;

/**
 * Wires up press-and-hold auto-repeat for a stepper button, mimicking the
 * browser-native `<input type=number>` spinner. A single click/tap/keyboard
 * activation still fires exactly once via `onClick`; a held pointer fires
 * once immediately and then repeats after an initial delay.
 */
function useHoldToRepeat(
  onStep: () => void,
  atLimit: () => boolean,
  disabled: boolean | undefined
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heldByPointerRef = useRef(false);

  const clearTimers = () => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
  };

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
      clearTimeout(releaseTimeoutRef.current);
    };
  }, []);

  // If the button becomes disabled mid-hold (e.g. an external state change,
  // not just reaching min/max), pointerup/leave/cancel may never fire on it.
  useEffect(() => {
    if (disabled) {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
    }
  }, [disabled]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      heldByPointerRef.current = true;
      onStep();
      if (atLimit()) return;
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          onStep();
          if (atLimit()) clearTimers();
        }, HOLD_REPEAT_INTERVAL_MS);
      }, HOLD_INITIAL_DELAY_MS);
    },
    onPointerUp: () => {
      clearTimers();
      // A genuine click's `click` event fires synchronously right after
      // `pointerup`, so it resets the flag itself before this runs. If the
      // pointer was released off-element (no `click` follows), this is what
      // clears the flag so it doesn't swallow the next keyboard activation.
      releaseTimeoutRef.current = setTimeout(() => {
        heldByPointerRef.current = false;
      }, 0);
    },
    onPointerLeave: clearTimers,
    onPointerCancel: clearTimers,
    onClick: () => {
      if (heldByPointerRef.current) {
        heldByPointerRef.current = false;
        return;
      }
      onStep();
    }
  };
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
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

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
    const snapped = snap(clamp(valueRef.current + delta));
    valueRef.current = snapped;
    onChange(snapped);
    setDraft(format(snapped));
  };

  const decrementHold = useHoldToRepeat(
    () => stepBy(-step),
    () => valueRef.current <= min,
    disabled
  );
  const incrementHold = useHoldToRepeat(
    () => stepBy(step),
    () => valueRef.current >= max,
    disabled
  );

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || value <= min}
        aria-label={ariaLabel ? `${ariaLabel}を減らす` : 'decrement'}
        {...decrementHold}
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
        {...incrementHold}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

export default NumberStepper;
