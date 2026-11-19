import { css, unsafeCSS, type CSSResult } from 'lit';

/** Shared minimum target dimensions. */
export const iconHitTarget = css`
  min-inline-size: var(--lr-icon-button-size);
  min-block-size: var(--lr-icon-button-size);
`;

/** Shared keyboard focus outline. */
export const focusRing = css`
  outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
  outline-offset: var(--lr-focus-ring-offset);
`;

/** Keyboard focus outline drawn inside the box, for controls whose overflow or neighbours would clip an outer ring. */
export const focusRingInset = css`
  outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
  outline-offset: calc(-1 * var(--lr-focus-ring-width));
`;

/** Inset focus outline whose inward step also absorbs the configured outer offset, so a themed offset never pushes it outside the box. */
export const focusRingInsetOffset = css`
  outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
  outline-offset: calc(
    -1 * max(var(--lr-focus-ring-width), calc(var(--lr-focus-ring-width) + var(--lr-focus-ring-offset)))
  );
`;

/**
 * The hover fill: the given base mixed toward the theme partner by the hover step. Pass the
 * state's OWN fill (the selected or current fill for a selected row), so a selected row keeps its
 * identity under the pointer instead of being repainted from the resting surface. Returns a value
 * expression, usable in any color property; `base` is author-controlled CSS, never user input.
 */
export function hoverFill(base: string): CSSResult {
  return unsafeCSS(`color-mix(in oklab, ${base}, var(--lr-color-mix-partner) var(--lr-color-mix-hover))`);
}

/** The pressed fill; same contract as `hoverFill`, mixed by the active step. */
export function activeFill(base: string): CSSResult {
  return unsafeCSS(`color-mix(in oklab, ${base}, var(--lr-color-mix-partner) var(--lr-color-mix-active))`);
}

/** The one pointer-interaction transition (fill, text and border); flattened by the reduced-motion token. */
export const interactiveTransition = css`
  transition: var(--lr-transition-interactive);
`;

/** Disabled affordance: dimmed and not-allowed. Gate hover and press rules with :not(:disabled) separately. */
export const disabledControl = css`
  opacity: var(--lr-opacity-disabled);
  cursor: not-allowed;
`;

/**
 * Minimum target for an icon action inside a form field: the icon-button floor capped at the
 * field's own tier height (so a compact field does not grow), never below the 24px WCAG 2.5.8
 * minimum.
 */
export const formControlIconHitTarget = css`
  min-inline-size: max(var(--lr-size-24px), min(var(--lr-icon-button-size), var(--lr-form-control-height)));
  min-block-size: max(var(--lr-size-24px), min(var(--lr-icon-button-size), var(--lr-form-control-height)));
`;

/** Selectors for {@link disclosureChevron}; author-controlled CSS, never user input. */
export interface DisclosureChevronSelectors {
  /** The chevron glyph wrapper. */
  readonly glyph: string;
  /** The glyph while expanded (rotated to point down). */
  readonly expanded: string;
  /** The glyph while collapsed under RTL (mirrored to point left). */
  readonly collapsedRtl: string;
}

/**
 * A right-pointing disclosure chevron that rotates a quarter turn when expanded and mirrors while
 * collapsed under RTL; the expanded glyph is symmetric, so it needs no mirroring. The rotation
 * stops under reduced motion.
 */
export function disclosureChevron(selectors: DisclosureChevronSelectors): CSSResult {
  const { glyph, expanded, collapsedRtl } = selectors;
  return unsafeCSS(`${glyph} { display: inline-flex; flex: 0 0 auto; transition: transform var(--lr-transition-fast); }
  ${expanded} { transform: rotate(90deg); }
  ${collapsedRtl} { transform: scaleX(-1); }
  @media (prefers-reduced-motion: reduce) { ${glyph} { transition: none; } }`);
}
