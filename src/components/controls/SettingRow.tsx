import type * as React from 'react';

import { cn } from '@/lib/utils';

interface SettingRowProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * A labelled settings row: a left-aligned label and a control on the right.
 * Replaces the Chakra `HStack` + `Text` boilerplate used across settings.
 */
export function SettingRow({ label, children, className }: SettingRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[var(--setting-label-w)_minmax(0,1fr)] items-center gap-x-3 [&_[data-slot=select-trigger]]:w-full',
        className
      )}
    >
      <span className="text-sm font-medium leading-snug text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export default SettingRow;
