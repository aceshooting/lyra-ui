import { overlaySurface } from '../../../internal/overlay-surface.styles.js';
import { forcedColorsPart } from '../../../internal/forced-colors.styles.js';
import { activeFill, disabledControl, focusRing, hoverFill } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { visuallyHidden } from '../../../internal/a11y.js';
import { minimumPointerTarget } from '../../../internal/minimum-pointer-target.styles.js';

export const styles = css`
  :host {
    /* A column of [.row, [part="children"]] rather than a single row, so a disclosed child list
       stacks BELOW the item's own control instead of squeezing into its row. [part="children"]
       does not exist at all while nothing is slotted into children (see the class doc), and a
       flex container creates no gap around an absent child, so an item with no nested items
       lays out exactly as it did before this feature existed -- gap only ever applies between
       .row and a REAL [part="children"]. */
    display: flex;
    flex-direction: column;
    gap: var(--lr-app-rail-item-children-gap, var(--lr-app-rail-item-gap, var(--lr-space-s)));
    inline-size: 100%;
  }
  /* Everything this item rendered before it could own children: the link/button and its
     meta/end/toggle adornments. Carries the exact flex/gap/alignment :host itself used to declare
     -- moved here, not changed, so this row's own children measure identically either way. */
  .row {
    display: flex;
    align-items: center;
    gap: var(--lr-app-rail-item-gap, var(--lr-space-s));
    inline-size: 100%;
  }
  [part="base"] {
    /* Anchors the absolutely-positioned [part="current-indicator"] below. */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: var(--lr-app-rail-item-gap, var(--lr-space-s));
    /* Grows to the whole row on its own and absorbs every bit of shrinkage once an adornment is
       slotted, so the trailing wrappers keep their intrinsic width instead of squeezing. */
    flex: 1 1 auto;
    min-inline-size: 0;
    inline-size: 100%;
    min-block-size: max(
      ${minimumPointerTarget},
      var(--lr-icon-button-size),
      var(--lr-app-rail-item-min-block-size, var(--lr-icon-button-size))
    );
    padding: var(--lr-app-rail-item-padding, var(--lr-space-s));
    border: 0;
    border-radius: var(--lr-app-rail-item-radius, var(--lr-radius));
    background: transparent;
    color: var(--lr-app-rail-item-color, var(--lr-color-text));
    font: inherit;
    /* After the "font" shorthand, which would otherwise reset font-size back to the inherited
       one -- mirrors lr-button's own --lr-button-font-size ordering. */
    font-size: var(--lr-app-rail-item-font-size, inherit);
    text-align: start;
    text-decoration: none;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  /* Keep larger row targets on devices with touch input or without a hovering fine pointer. */
  @media (hover: hover) and (pointer: fine) and (not (any-pointer: coarse)) {
    :host(:not([icon-only])) [part="base"] {
      min-block-size: max(
        ${minimumPointerTarget},
        var(--lr-app-rail-item-min-block-size, var(--lr-icon-button-size))
      );
    }
  }
  [part="base"]:not([aria-disabled="true"]):hover {
    background: var(--lr-app-rail-item-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-item-hover-color, var(--_lr-glass-brand-text, var(--lr-color-brand)));
  }
  /* The current row paints the same brand-quiet fill hover does, so hover steps one mix tier past
     the current fill instead of repainting it unchanged. */
  [part="base"][aria-current="page"]:not([aria-disabled="true"]):hover:not(:active) {
    background: var(
      --lr-app-rail-item-current-hover-bg,
      ${hoverFill('var(--lr-app-rail-item-current-bg, var(--lr-color-brand-quiet))')}
    );
  }
  /* Pressed travels further along hover's own axis: the same brand-quiet fill mixed toward
     --lr-color-mix-partner, which follows the text colour, so it deepens on a light theme and
     lightens on a dark one rather than depending on a brightness multiplier's direction. */
  [part="base"]:not([aria-disabled="true"]):active {
    background: var(
      --lr-app-rail-item-active-bg,
      ${activeFill('var(--lr-color-brand-quiet)')}
    );
    color: var(--lr-app-rail-item-active-color, var(--_lr-glass-brand-text, var(--lr-color-brand)));
  }
  [part="base"]:focus-visible {
    ${focusRing}
  }
  [part="base"][aria-disabled="true"] {
    ${disabledControl}
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor and no :host declaration shadows that. ::part(base)[aria-current='page'] is invalid
     CSS -- an attribute selector cannot follow ::part -- so hijacking the shared
     --lr-color-brand-quiet/--lr-color-brand tokens was previously the only route, repainting every
     other element reading them. Unset, each falls back to the token used before. */
  [part="base"][aria-current="page"] {
    background: var(--lr-app-rail-item-current-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-item-current-color, var(--_lr-glass-brand-text, var(--lr-color-brand)));
    font-weight: var(
      --lr-app-rail-item-current-font-weight,
      var(--lr-font-weight-semibold)
    );
    /* Inert (none) by default here -- full presentation already conveys current state through the
       indicator bar below plus the font-weight above. :host([icon-only]) re-declares this same
       custom property with a visible fallback, so an unset token still leaves full presentation
       byte-identical while icon-only gets a ring automatically (see that rule for why). */
    box-shadow: var(--lr-app-rail-item-current-ring, none);
  }
  /* Mirrors lr-conversation-item's shipped [part="active-indicator"] (same inset-inline/width/
     color token shape); rendered only while aria-current="page" (see the class doc), so it is
     absent whenever this rule would otherwise be inert. */
  [part="current-indicator"] {
    position: absolute;
    inset-block: 0;
    inset-inline: var(--lr-app-rail-item-current-indicator-inset-inline, 0 auto);
    inline-size: var(--lr-app-rail-item-current-indicator-width, var(--lr-size-2px));
    box-sizing: border-box;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-app-rail-item-current-indicator-color, var(--lr-color-brand));
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  [part="icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* Deliberately floors only the inline axis: [part='base']'s own min-block-size above already
       guarantees the row's tappable height, so flooring the block axis too would add nothing for
       target size while forcing every row to --lr-icon-button-size + 2x --lr-space-s. Unlike the
       row's own min-block-size hook, this one is not floor-clamped: the icon is decorative
       content, not itself a pointer target, so shrinking it never shrinks the row's own hit area. */
    inline-size: var(--lr-app-rail-item-icon-size, var(--lr-icon-button-size));
    min-inline-size: var(--lr-app-rail-item-icon-size, var(--lr-icon-button-size));
  }
  /* Nothing slotted into start: no icon column and, as a display:none flex item, no gap. */
  [part="icon"][hidden] {
    display: none;
  }
  [part="meta"],
  [part="end"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  [part="meta"][hidden],
  [part="end"][hidden] {
    display: none;
  }
  [part="meta"] {
    color: var(--lr-app-rail-item-meta-color, var(--lr-color-text-quiet));
    font-size: var(--lr-app-rail-item-meta-font-size, var(--lr-font-size-sm));
  }
  [part="label"] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([icon-only]) [part="label"] {
    ${visuallyHidden}
  }
  :host([icon-only]) [part="base"] {
    justify-content: center;
    padding-inline: 0;
    /* Matches the icon-button hit-target footprint used elsewhere in this library instead of
       stretching across the rail's full icon column: flex-basis auto plus flex-grow 0 stops the
       row filling :host's own width (:host([icon-only]) below re-centers it there), and
       inline-size: auto lets aspect-ratio resolve the now-auto inline axis from the block axis
       above -- already floor-clamped to --lr-icon-button-size -- producing a square regardless of
       the floor's own value. */
    flex: 0 0 auto;
    /* var()-wrapped so an unset --lr-app-rail-item-icon-only-size still declares the exact same
       'auto' used value as before -- inline-size resolving through aspect-ratio against the row's
       own (block-size: auto, min-block-size floor-clamped) cross size. Set, both axes take the
       token directly instead, sizing the square independently of the row height; aspect-ratio
       then has nothing left to resolve, since neither axis is auto anymore. */
    inline-size: var(--lr-app-rail-item-icon-only-size, auto);
    block-size: var(--lr-app-rail-item-icon-only-size, auto);
    /* An explicit square size is independent of the labeled row height. The derived
       square retains the shared icon-button floor. Both enforce the pointer minimum. */
    min-inline-size: ${minimumPointerTarget};
    min-block-size: max(
      ${minimumPointerTarget},
      var(
        --lr-app-rail-item-icon-only-size,
        max(var(--lr-icon-button-size), var(--lr-app-rail-item-min-block-size, var(--lr-icon-button-size)))
      )
    );
    aspect-ratio: 1;
  }
  :host([icon-only]) .row {
    justify-content: center;
  }
  /* Presentation-aware: a full-height edge bar reads as a rendering glitch on the square
     icon-only tile, so it is suppressed there by default. --lr-app-rail-item-current-indicator-
     display restores it per instance. Full presentation is untouched -- [part="current-indicator"]'s
     own rule above declares no display at all, so it keeps its unconditional absolute-positioned
     bar exactly as before. */
  :host([icon-only]) [part="current-indicator"] {
    display: var(--lr-app-rail-item-current-indicator-display, none);
  }
  /* Non-color-only replacement for the bar suppressed above (WCAG 1.4.1): an inset ring, not
     merely a hue change, stays perceivable without color vision. Reuses the indicator's own color
     token so retheming one retints both. More specific than the generic
     [part="base"][aria-current="page"] rule above (which shares this same custom property with a
     'none' fallback), so this wins whenever icon-only applies -- a consumer setting the token on
     an ancestor overrides both rules identically. */
  :host([icon-only]) [part="base"][aria-current="page"] {
    box-shadow: var(
      --lr-app-rail-item-current-ring,
      inset 0 0 0 var(--lr-border-width-thin)
        var(--lr-app-rail-item-current-indicator-color, var(--lr-color-brand))
    );
  }
  /* Secondary text follows the label: clipped out of the narrow rail's layout while staying in the
     accessibility tree. clip-path (rather than [part="label"]'s position:absolute + clip) keeps the
     wrapper a flex item with no containing-block dependency of its own -- this element has no
     positioned ancestor inside the item. [part="end"] deliberately does NOT collapse: a badge or
     overflow trigger is the reason a consumer reaches for that slot at all. */
  :host([icon-only]) [part="meta"] {
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* A sibling of [part="base"], never nested inside it (see the class doc). Always a fixed
     icon-button-sized square in BOTH presentations -- unlike [part="base"], it never carries a
     label to shrink around, so it needs no separate icon-only rule of its own. */
  [part="toggle"] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    /* The square follows the token, but its used size never drops below the minimum pointer
       target, however small the requested value. */
    inline-size: max(
      ${minimumPointerTarget},
      var(--lr-app-rail-item-toggle-size, var(--lr-icon-button-size))
    );
    block-size: max(
      ${minimumPointerTarget},
      var(--lr-app-rail-item-toggle-size, var(--lr-icon-button-size))
    );
    min-inline-size: var(--lr-app-rail-item-toggle-size, var(--lr-icon-button-size));
    min-block-size: var(--lr-app-rail-item-toggle-size, var(--lr-icon-button-size));
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    /* Reuses [part="base"]'s own hover/active/focus tokens rather than introducing a second,
       disclosure-only set -- both controls belong to the same item and one retheme should recolor
       both consistently. */
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part="toggle"]:hover {
    background: var(--lr-app-rail-item-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-item-hover-color, var(--_lr-glass-brand-text, var(--lr-color-brand)));
  }
  [part="toggle"]:active {
    background: var(
      --lr-app-rail-item-active-bg,
      ${activeFill('var(--lr-color-brand-quiet)')}
    );
    color: var(--lr-app-rail-item-active-color, var(--_lr-glass-brand-text, var(--lr-color-brand)));
  }
  [part="toggle"]:focus-visible {
    ${focusRing}
  }
  /* icons.ts ships one right-pointing chevron and asks callers to rotate the WRAPPING element.
     Open points down (the content below it), closed points along the reading direction --
     mirrors <lr-app-rail-group>'s own [part="toggle-icon"] exactly. */
  [part="toggle-icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    transform: rotate(90deg);
    transition: transform var(--lr-transition-fast);
  }
  [part="toggle"]:where([aria-expanded="false"]) [part="toggle-icon"] {
    transform: none;
  }
  :host(:dir(rtl)) [part="toggle"]:where([aria-expanded="false"]) [part="toggle-icon"] {
    transform: rotate(180deg);
  }
  /* A column stack of the slotted nested items, indented one step from this item's own row.
     Rendered only alongside [part="toggle"] (see the class doc); [hidden] while collapsed. */
  [part="children"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-app-rail-item-gap, var(--lr-space-s));
    padding-inline-start: var(--lr-app-rail-item-indent, var(--lr-space-l));
    inline-size: 100%;
  }
  [part="children"][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="toggle"],
    [part="toggle-icon"] {
      transition: none !important;
    }
  }
  [part="tooltip"] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    ${overlaySurface}
    color: var(--lr-color-text);
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    font-size: var(--lr-font-size-sm);
    box-sizing: border-box;
    max-inline-size: var(
      --lr-positioner-available-inline-size,
      var(--lr-popover-viewport-clamp, calc(100vw - 2 * var(--lr-space-s)))
    );
    overflow-wrap: anywhere;
    white-space: normal;
    pointer-events: none;
  }
  :host([icon-only]) [part="toggle"],
  :host([icon-only]) [part="children"] {
    display: none;
  }
  /* highlight="row": the row paints the hover, press and current fills, and the base stays clear
     so the fill reads as one continuous shape behind base, meta, end and the disclosure. Each
     control keeps its own focus ring. */
  :host([highlight="row"]) [part="row"] {
    border-radius: var(--lr-app-rail-item-radius, var(--lr-radius));
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  :host([highlight="row"]) [part="row"] > [part="base"]:is(:hover, :active, [aria-current="page"]),
  :host([highlight="row"]) [part="row"] > [part="toggle"]:is(:hover, :active) {
    background: transparent;
  }
  :host([highlight="row"]:not([disabled])) [part="row"]:hover {
    background: var(--lr-app-rail-item-hover-bg, var(--lr-color-brand-quiet));
  }
  :host([highlight="row"]:not([disabled])) [part="row"]:hover > [part="base"] {
    color: var(--lr-app-rail-item-hover-color, var(--_lr-glass-brand-text, var(--lr-color-brand)));
  }
  :host([highlight="row"][current]) [part="row"] {
    background: var(--lr-app-rail-item-current-bg, var(--lr-color-brand-quiet));
  }
  :host([highlight="row"][current]:not([disabled])) [part="row"]:hover {
    background: var(
      --lr-app-rail-item-current-hover-bg,
      ${hoverFill('var(--lr-app-rail-item-current-bg, var(--lr-color-brand-quiet))')}
    );
  }
  :host([highlight="row"]:not([disabled])) [part="row"]:has(> [part="base"]:active, > [part="toggle"]:active) {
    background: var(
      --lr-app-rail-item-active-bg,
      ${activeFill('var(--lr-color-brand-quiet)')}
    );
  }
  @media (prefers-reduced-motion: reduce) {
    :host([highlight="row"]) [part="row"] {
      transition: none;
    }
  }
  ${forcedColorsPart('[part="base"][aria-current="page"]')}
`;
