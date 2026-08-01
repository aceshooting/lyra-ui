import { css } from "lit";

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width when it's a flex/grid
       item in a consumer's own narrow layout -- the default min-width:auto for flex
       items would otherwise force the scroll container wide. */
    min-inline-size: 0;
    max-inline-size: 100%;
    /* One ladder for the whole library (internal/sizes.styles.ts): the track floor, the segment
       padding and the segment font size are the tier's own --lr-form-control-* values, so a toolbar
       built with same-size controls shows this control at a matching height beside them, per the
       class doc's own "flush beside those controls" promise. This component used to carry six
       :host([size=...]) blocks of its own, on a scale that had drifted from that one. */
    --lr-segmented-track-min-height: var(--lr-form-control-height);
    --lr-segmented-segment-padding: var(--lr-form-control-padding-block)
      var(--lr-form-control-padding-inline);
    --lr-segmented-font-size: var(--lr-form-control-font-size);
  }
  [part="base"] {
    display: inline-flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    min-inline-size: 0;
    /* --lr-segmented-track-height is deliberately NEVER declared anywhere: an exact-height hatch
       only works as an undeclared sentinel, so the fallback arm below can fall through to the
       per-size --lr-segmented-track-min-height floor. Declaring it as "auto" on :host would be a
       valid value that always wins, silently making the per-size floor dead code. */
    min-block-size: var(
      --lr-segmented-track-height,
      var(--lr-segmented-track-min-height)
    );
    block-size: var(--lr-segmented-track-height, auto);
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-segmented-track-radius, var(--lr-radius));
    padding: var(--lr-segmented-track-padding, var(--lr-size-0-125rem));
    gap: var(--lr-segmented-track-gap, var(--lr-size-0-125rem));
  }
  /* Edge fade, gated on the track actually overflowing -- ScrollOverflowController toggles
     data-scroll-overflow from a real scrollWidth/clientWidth measurement. This used to be painted
     unconditionally ("a low-cost affordance that needs no observers"), which is only harmless when
     there IS overflow: at the 2rem-per-edge default a two-option row (Overall | Daily) is narrower
     than its own two fades, so both labels rendered half-transparent and the control read as
     disabled. */
  [part="base"][data-scroll-overflow] {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="segment"] {
    min-inline-size: 0;
    border: none;
    border-radius: calc(var(--lr-form-control-radius) * 0.7);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-segmented-font-size);
    padding: var(--lr-segmented-segment-padding);
    cursor: pointer;
  }
  :host([size="2xs"]) [part="segment"],
  :host([size="xs"]) [part="segment"] {
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
  }
  [part="segment-icon"] {
    display: inline-flex;
    align-items: center;
    margin-inline-end: var(--lr-space-xs);
    block-size: var(--lr-size-1em);
    max-inline-size: var(--lr-size-2-5rem);
  }
  [part="segment"][aria-disabled="true"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  /* Reads its own prop, not the shared --lr-color-text token the selected state used to share:
     recoloring the selected pill must never repaint hovered-unselected segments with it.
     :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, functionally identical selection to the unwrapped shape but now losing (on
     the pseudo-element tiebreak) to a consumer's own ::part(segment):hover override ((0,1,1))
     without that consumer needing !important -- mirrors lr-attachment-trigger's identical fix. */
  :where([part="segment"]):hover:where(
      :not([aria-disabled="true"]):not([aria-checked="true"])
    ) {
    color: var(--lr-segmented-hover-color, var(--lr-color-text));
  }
  [part="segment"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Every value here is an inline var() fallback rather than a :host-declared property on purpose:
     :host is re-declared per size tier, which would shadow any value a consumer sets on an
     ancestor -- exactly what these hooks exist to allow. Unset, each falls back to the token the
     rule used before the hooks existed, so the rendering is unchanged. */
  [part="segment"][aria-checked="true"] {
    background: var(--lr-segmented-selected-bg, var(--lr-color-surface));
    color: var(--lr-segmented-selected-color, var(--lr-color-text));
    font-weight: var(
      --lr-segmented-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
    /* Smallest step in the scale: the checked segment is a thumb lifted a hair off its own track,
       the shallowest piece of resting chrome the library has. */
    box-shadow: var(--lr-segmented-selected-shadow, var(--lr-shadow-xs));
  }
`;
