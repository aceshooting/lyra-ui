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

/**
 * Keyboard focus outline through the composite `--lr-focus-ring` shorthand, so a consumer that
 * overrides that one token (a dashed or forced-colors ring) reaches it; otherwise identical to
 * {@link focusRing}.
 */
export const focusRingShorthand = css`
  outline: var(--lr-focus-ring);
  outline-offset: var(--lr-focus-ring-offset);
`;

/**
 * The room an overflow container leaves around focusable children so their outer focus ring
 * paints whole: the ring width plus the configured offset, never negative. A value, for padding
 * (paired with an equal negative margin where the children must not move).
 */
export const focusRingRoom = css`max(0px, calc(var(--lr-focus-ring-width) + var(--lr-focus-ring-offset)))`;

/** Keyboard focus outline pulled inward by the configured outer offset, for controls that cannot paint outside their box. */
export const focusRingInwardOffset = css`
  outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
  outline-offset: calc(-1 * var(--lr-focus-ring-offset));
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
 * Keyboard focus outline through the composite `--lr-focus-ring` shorthand, pulled inward by the
 * configured outer offset. The shorthand twin of {@link focusRingInwardOffset}.
 */
export const focusRingShorthandInward = css`
  outline: var(--lr-focus-ring);
  outline-offset: calc(-1 * var(--lr-focus-ring-offset));
`;

/** Shorthand focus outline drawn inside the box, like {@link focusRingInset} but through `--lr-focus-ring`. */
export const focusRingShorthandInset = css`
  outline: var(--lr-focus-ring);
  outline-offset: calc(-1 * var(--lr-focus-ring-width));
`;

/** Shorthand focus outline with the inset-with-outer-offset step, like {@link focusRingInsetOffset}. */
export const focusRingShorthandInsetOffset = css`
  outline: var(--lr-focus-ring);
  outline-offset: calc(
    -1 * max(var(--lr-focus-ring-width), calc(var(--lr-focus-ring-width) + var(--lr-focus-ring-offset)))
  );
`;

/** Focus outline drawn inside the box by the larger of the configured offset and the ring width. */
export const focusRingInwardMax = css`
  outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
  outline-offset: calc(-1 * max(var(--lr-focus-ring-offset), var(--lr-focus-ring-width)));
`;

/**
 * Offset-only declarations, for a rule whose outline colour or style is its own (a selected or
 * matched highlight) but whose placement follows the focus-ring tokens. Each pairs with the
 * same-named outline fragment above.
 */
export const focusRingOffset = css`
  outline-offset: var(--lr-focus-ring-offset);
`;

/** The ring width pulled inward (the offset-only twin of {@link focusRingInset}). */
export const focusRingOffsetInset = css`
  outline-offset: calc(-1 * var(--lr-focus-ring-width));
`;

/** The configured outer offset pulled inward (the offset-only twin of {@link focusRingInwardOffset}). */
export const focusRingOffsetInward = css`
  outline-offset: calc(-1 * var(--lr-focus-ring-offset));
`;

/** Inset step that also absorbs the configured offset (the offset-only twin of {@link focusRingInsetOffset}). */
export const focusRingOffsetInsetOffset = css`
  outline-offset: calc(
    -1 * max(var(--lr-focus-ring-width), calc(var(--lr-focus-ring-width) + var(--lr-focus-ring-offset)))
  );
`;

/**
 * The ring outline in a caller-chosen colour, for a selected, matched or accent-tinted element
 * whose width still follows the focus-ring tokens. `color` is author-controlled CSS, never user
 * input. `widthHook` names a documented `--lr-*` width override placed in front of the ring width.
 */
export function focusRingOutline(color: string, widthHook?: string): CSSResult {
  const width = widthHook ? `var(${widthHook}, var(--lr-focus-ring-width))` : 'var(--lr-focus-ring-width)';
  return unsafeCSS(`outline: ${width} solid ${color};`);
}

/**
 * The standard ring outline with a documented per-component replacement in front of it, so a
 * consumer can swap the whole keyboard outline (for example for a halo) through one `--lr-*` token.
 * `hook` is author-controlled, never user input. Pair it with a forced-colors rule that restores
 * {@link focusRing}, so the replacement cannot remove a visible indicator there.
 */
export function focusRingOutlineFrom(hook: string): CSSResult {
  return unsafeCSS(`outline: var(${hook}, var(--lr-focus-ring-width) solid var(--lr-focus-ring-color));`);
}

/**
 * The outer offset (or, with `placement: 'inward'`, its inward twin) with a documented per-component
 * override in front of it. `hook` is the `--lr-*` name a consumer may set; author-controlled,
 * never user input.
 */
export function focusRingOffsetFrom(hook: string, placement: 'outer' | 'inward' = 'outer'): CSSResult {
  const fallback = placement === 'inward' ? 'calc(-1 * var(--lr-focus-ring-offset))' : 'var(--lr-focus-ring-offset)';
  return unsafeCSS(`outline-offset: var(${hook}, ${fallback});`);
}

/** Only the composite `--lr-focus-ring` outline, for a rule whose offset is declared by another fragment. */
export const focusRingShorthandOutline = css`
  outline: var(--lr-focus-ring);
`;

/**
 * Shorthand focus outline drawn inside a box that carries its own hairline frame: the inward step
 * clears the frame as well as the ring and the configured offset.
 */
export const focusRingShorthandInsetPastFrame = css`
  outline: var(--lr-focus-ring);
  outline-offset: calc(
    -1 * max(var(--lr-focus-ring-width) + 2 * var(--lr-border-width-thin), var(--lr-focus-ring-width) + var(--lr-focus-ring-offset))
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

/**
 * The hover tint: the given accent at the hover share over transparent, for rows and cells whose
 * hover must stay translucent on any background. Same contract as `hoverFill`.
 */
export function hoverTint(accent: string): CSSResult {
  return unsafeCSS(`color-mix(in srgb, ${accent} var(--lr-color-mix-hover), transparent)`);
}

/** The pressed tint; same contract as `hoverTint`, at the active share. */
export function activeTint(accent: string): CSSResult {
  return unsafeCSS(`color-mix(in srgb, ${accent} var(--lr-color-mix-active), transparent)`);
}

/**
 * The hover fill for a surface that tracks the text colour rather than the theme partner (pickers
 * whose rows sit on the plain surface): the base mixed toward `--lr-color-text` by the hover step.
 * Same contract as {@link hoverFill}.
 */
export function hoverFillTowardText(base: string): CSSResult {
  return unsafeCSS(`color-mix(in oklab, ${base}, var(--lr-color-text) var(--lr-color-mix-hover))`);
}

/** The pressed fill toward the text colour; same contract as {@link hoverFillTowardText}, at the active step. */
export function activeFillTowardText(base: string): CSSResult {
  return unsafeCSS(`color-mix(in oklab, ${base}, var(--lr-color-text) var(--lr-color-mix-active))`);
}

/**
 * The hover fill for a solid-filled control, whose resting colour is already strong: the base mixed
 * toward `--lr-color-text` by TWICE the hover step (capped at 100%), so the change still reads against
 * an opaque brand or status fill. Same contract as {@link hoverFill}.
 */
export function hoverFillDoubled(base: string): CSSResult {
  return unsafeCSS(`color-mix(in oklab, ${base}, var(--lr-color-text) min(100%, calc(2 * var(--lr-color-mix-hover))))`);
}

/** The pressed fill of a solid-filled control; same contract as {@link hoverFillDoubled}, at twice the active step. */
export function activeFillDoubled(base: string): CSSResult {
  return unsafeCSS(`color-mix(in oklab, ${base}, var(--lr-color-text) min(100%, calc(2 * var(--lr-color-mix-active))))`);
}

/**
 * The pressed wash: the given accent (often `currentColor`) laid over the given underlay at the
 * active share, for chips, tags and remove buttons whose hover is a translucent wash. Both arguments
 * are author-controlled CSS, never user input.
 */
export function activeWash(accent: string, underlay: string): CSSResult {
  return unsafeCSS(`color-mix(in srgb, ${accent} var(--lr-color-mix-active), ${underlay})`);
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
