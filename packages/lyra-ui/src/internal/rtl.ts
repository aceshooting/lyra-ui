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
