import type { Placement } from '@floating-ui/dom';

/**
 * Where the arrow sits along the popup's edge.
 *
 * - `anchor` — tracks the anchor's centre, the position Floating UI's `arrow` middleware computes.
 * - `start` / `end` — pinned `arrow-padding` from one logical end of that edge. On a top/bottom
 *   placement the two ends are the inline ones, so they swap under RTL; on a left/right placement
 *   they are the block ends, which do not.
 * - `center` — pinned to the middle of the edge regardless of where the anchor is.
 */
export type LyraArrowPlacement = 'anchor' | 'start' | 'end' | 'center';

export type OverlayArrowSide = 'top' | 'bottom' | 'left' | 'right';

const OPPOSITE_SIDE: Record<OverlayArrowSide, OverlayArrowSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

function sideOf(placement: Placement): OverlayArrowSide {
  const side = placement.split('-')[0];
  return side === 'top' || side === 'bottom' || side === 'left' || side === 'right' ? side : 'bottom';
}

export interface OverlayArrowOptions {
  /** The placement Floating UI actually used, which `flip()` may have changed. */
  placement: Placement;
  /** The `arrow` middleware's offsets within the popup, present only for `arrowPlacement: 'anchor'`. */
  coords: { x?: number; y?: number } | undefined;
  /** Whether an arrow is being rendered at all. */
  enabled: boolean;
  arrowPlacement: LyraArrowPlacement;
  arrowPadding: number;
  /** Whether the popup's own resolved direction is RTL, which mirrors `start`/`end` on an
   *  inline-axis edge. */
  rtl: boolean;
  /** The component-scoped custom property holding half the arrow's width. */
  sizeProperty: string;
}

/**
 * Positions a popup's arrow element for the placement that was actually used, and returns the
 * resolved side so the caller can put it in the arrow's part name. Physical inset properties are
 * written here on purpose: the arrow's own offsets are computed in physical pixels by Floating UI,
 * and mixing them with logical properties would leave two competing insets active on the same axis
 * under RTL. The logical intent of `start`/`end` is resolved to a physical side by `rtl` instead.
 */
export function applyOverlayArrow(
  arrowElement: HTMLElement | null,
  options: OverlayArrowOptions,
): OverlayArrowSide {
  const side = sideOf(options.placement);
  if (!options.enabled || !arrowElement) return side;

  const style = arrowElement.style;
  style.left = '';
  style.top = '';
  style.right = '';
  style.bottom = '';

  const half = `var(${options.sizeProperty}, var(--lr-size-0-375rem))`;
  const padding = `${options.arrowPadding}px`;
  const onInlineEdge = side === 'top' || side === 'bottom';

  if (options.arrowPlacement === 'anchor') {
    if (options.coords?.x !== undefined) style.left = `${options.coords.x}px`;
    if (options.coords?.y !== undefined) style.top = `${options.coords.y}px`;
  } else if (options.arrowPlacement === 'center') {
    if (onInlineEdge) style.left = `calc(50% - ${half})`;
    else style.top = `calc(50% - ${half})`;
  } else {
    const atStart = options.arrowPlacement === 'start';
    if (onInlineEdge) style.setProperty(atStart !== options.rtl ? 'left' : 'right', padding);
    else style.setProperty(atStart ? 'top' : 'bottom', padding);
  }

  // The arrow protrudes from the edge facing the anchor, which is the side opposite the popup's
  // resolved placement.
  style.setProperty(OPPOSITE_SIDE[side], `calc(-1 * ${half})`);
  return side;
}
