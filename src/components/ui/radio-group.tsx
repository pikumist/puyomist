import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';

import { cn } from '@/lib/utils';

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('grid gap-2.5', className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40',
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center data-unchecked:hidden"
      >
        <span className="size-2 rounded-full bg-primary" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

/**
 * 選択肢そのものが見た目 (色など) を持つときの、丸ではなくチップ型のラジオ。
 * 小さな丸の塗りつぶしでは選択状態が見分けにくいので、チップ全体を発色させ、
 * 枠線・太字・チェックで示す。中身は呼び出し側が組み立てる。
 */
function RadioGroupChip({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-chip"
      className={cn(
        'group/chip inline-flex cursor-pointer items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-foreground data-checked:font-bold data-checked:shadow-sm',
        className
      )}
      {...props}
    />
  );
}

/**
 * 2〜3択のモード切替 (セグメンテッドコントロール) の器。
 *
 * **枠線を使わない。** 1px の枠線は画面密度が 150% のような中途半端な値だと
 * 物理ピクセルに割り切れず、辺ごとに太さが変わって汚く見える。
 * 代わりに「地の器 + 選択中だけ浮かせる塗り」で示す。
 */
function RadioGroupSegments({
  className,
  ...props
}: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group-segments"
      className={cn(
        'inline-flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5',
        className
      )}
      {...props}
    />
  );
}

/** [`RadioGroupSegments`] の選択肢1つ。 */
function RadioGroupSegment({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-segment"
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-background data-checked:font-semibold data-checked:text-foreground data-checked:shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export {
  RadioGroup,
  RadioGroupChip,
  RadioGroupItem,
  RadioGroupSegment,
  RadioGroupSegments
};
