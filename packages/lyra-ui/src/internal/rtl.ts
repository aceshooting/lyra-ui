import type { Placement } from '@floating-ui/dom';

/**
 * Whether `el` resolves to RTL text direction. Logical CSS properties
 * (`inset-inline-start`, etc.) already flip visual layout for free, but
 * pointer/keyboard math that reasons about physical left/right (drag ratios,
 * arrow-key direction) has to consult this explicitly to match.
 */
export function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === 'rtl';
}

/** A physical (not logical) horizontal side. */
export type PhysicalSide = 'left' | 'right';

/**
 * Swaps `side` under RTL, passes it through unchanged under LTR -- for
 * reasoning about a physical side (e.g. which edge an icon should point at,
 * or which edge of a track a dock panel resizes from) that logical CSS
 * properties alone can't express, since the caller needs the resolved
 * physical value itself (to rotate a glyph, to pick a Floating UI
 * `Placement`), not just a layout that flips for free.
 */
export function rtlAwareSide(side: PhysicalSide, el: Element): PhysicalSide {
  if (!isRtl(el)) return side;
  return side === 'left' ? 'right' : 'left';
}

/**
 * Swaps the `left`/`right` component of a Floating UI `Placement` under RTL
 * (`'right-start'` <-> `'left-start'`, etc.) -- `'top'`/`'bottom'`-based
 * placements are already direction-agnostic and pass through unchanged.
 * Floating UI's own `computePosition()` has no built-in RTL awareness (it
 * positions purely by the physical `left`/`right`/`top`/`bottom` it's given),
 * so a popover that means "anchor to my trailing edge" must resolve that
 * intent to a physical placement itself before calling `place()` from
 * `positioner.ts` -- this is the resolution step.
 */
export function rtlAwarePlacement(placement: Placement, el: Element): Placement {
  if (!isRtl(el)) return placement;
  return placement.replace(/^(left|right)/, (side) => (side === 'left' ? 'right' : 'left')) as Placement;
}
