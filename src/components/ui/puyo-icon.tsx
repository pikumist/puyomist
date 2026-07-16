import type * as React from 'react';

import {
  getAttrSymbolReference,
  getChanceSymbolReference,
  getPlusSymbolReference
} from '@/components/board-parts/logics/symbol-reference';
import { cn } from '@/lib/utils';
import { PuyoAttr } from '@/logics/PuyoAttr';
import {
  type PuyoType,
  getPuyoAttr,
  isChancePuyo,
  isPlusPuyo
} from '@/logics/PuyoType';

interface PuyoIconProps extends React.ComponentProps<'span'> {
  /** Puyo type. When provided, attr/chance/plus are derived from it. */
  type?: PuyoType;
  /** Explicit attribute, used when `type` is not given. */
  attr?: PuyoAttr;
  /** Icon edge length in px. */
  size?: number;
}

/**
 * Tailwind-only puyo icon. Renders the shared SVG sprite for a puyo
 * attribute, overlaying chance/plus marks when the type implies them.
 * Replaces the Chakra `<Box>`-based `PuyoIcon` with a plain span.
 */
function PuyoIcon({
  type,
  attr: attrProp,
  size = 24,
  className,
  ...props
}: PuyoIconProps) {
  const attr = getPuyoAttr(type) || attrProp || PuyoAttr.Question;
  const isChance = type ? isChancePuyo(type) : false;
  const isPlus = type ? isPlusPuyo(type) : false;

  return (
    <span
      data-slot="puyo-icon"
      className={cn('inline-flex shrink-0', className)}
      {...props}
    >
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative sprite icon */}
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <use width="48" height="48" xlinkHref={getAttrSymbolReference(attr)} />
        {isChance ? (
          <use width="48" height="48" xlinkHref={getChanceSymbolReference()} />
        ) : null}
        {isPlus ? (
          <use width="48" height="48" xlinkHref={getPlusSymbolReference()} />
        ) : null}
      </svg>
    </span>
  );
}

export { PuyoIcon };
