import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width as a flex/grid item in a narrow
       consumer layout; flex items' default min-width:auto would otherwise force the scroll
       container wide. */
    min-inline-size: 0;
    max-inline-size: 100%;
    /* One ladder for the whole library (internal/sizes.styles.ts): track floor, segment padding
       and segment font size are the tier's own --lr-form-control-* values, so a toolbar of
       same-size controls shows this one flush beside them, as the class doc promises. No
       :host([size=...]) blocks of its own; that private scale had drifted. */
    --_lr-segmented-track-min-height: var(--lr-form-control-height);
    --_lr-segmented-segment-padding: var(--lr-form-control-padding-block)
      var(--lr-form-control-padding-inline);
    --_lr-segmented-font-size: var(--lr-form-control-font-size);
  }
  [part="base"] {
    display: inline-flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    min-inline-size: 0;
    /* --lr-segmented-track-height is deliberately NEVER declared: an exact-height hatch only
       works as an undeclared sentinel, letting the fallback arm below reach the per-size
       --lr-segmented-track-min-height floor. Declaring it auto on :host would be a valid value
       that always wins, making that floor dead code. */
    min-block-size: var(
      --lr-segmented-track-height,
      var(
        --lr-segmented-track-min-height,
        var(--_lr-segmented-track-min-height)
      )
    );
    block-size: var(--lr-segmented-track-height, auto);
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-segmented-track-radius, var(--lr-radius));
    padding: var(--lr-segmented-track-padding, var(--lr-size-0-125rem));
    gap: var(--lr-segmented-track-gap, var(--lr-size-0-125rem));
  }
  /* Edge fade, gated on real overflow: ScrollOverflowController toggles data-scroll-overflow from
     a scrollWidth/clientWidth measurement. Unconditional fades are harmless only when there IS
     overflow -- at the 2rem-per-edge default a two-option row is narrower than its own two fades,
     so both labels rendered half-transparent and the control read as disabled. One-sided and
     RTL-aware, matching lr-tab-group: data-scroll-start/data-scroll-end (same controller,
     logical, live on scroll) name the edges with more to reach, so a track resting at one edge
     fades only the other. Both sit in :where() purely to hold these rules at (0,2,0), tying with
     plain [data-scroll-overflow] so the later forced-colors override wins on source order rather
     than leaving the mask painted. */
  [part="base"][data-scroll-overflow]:where([data-scroll-start][data-scroll-end]) {
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
  [part="base"][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="base"][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl))
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl))
    [part="base"][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
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
    font-size: var(--lr-segmented-font-size, var(--_lr-segmented-font-size));
    padding: var(
      --lr-segmented-segment-padding,
      var(--_lr-segmented-segment-padding)
    );
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
  /* Reads its own prop, not the --lr-color-text token the selected state shares, so recoloring
     the selected pill never repaints hovered-unselected segments. :where() zeroes the wrapped
     selectors, leaving (0,1,0) from :hover alone -- tying with the pressed rule below, which wins
     on source order while a segment is held. */
  :where([part="segment"]):hover:where(
      :not([aria-disabled="true"]):not([aria-checked="true"])
    ) {
    color: var(--lr-segmented-hover-color, var(--lr-color-text));
  }
  /* Hover lifts only the label colour here, so pressed adds a surface to be a visible step past
     it: the segment's transparent fill mixed toward --lr-color-mix-partner at
     --lr-color-mix-active alpha over whatever track colour the theme uses. Same :not() guards and
     zeroed specificity as the hover rule it twins. */
  :where([part="segment"]):active:where(
      :not([aria-disabled="true"]):not([aria-checked="true"])
    ) {
    background: var(
      --lr-segmented-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(
      --lr-segmented-active-color,
      var(--lr-segmented-hover-color, var(--lr-color-text))
    );
  }
  [part="segment"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Inline var() fallbacks, not :host-declared properties: :host is re-declared per size tier and
     would shadow any value a consumer sets on an ancestor, which is exactly what these hooks
     exist to allow. Unset, each falls back to the token the rule used before the hooks existed.
     */
  [part="segment"][aria-checked="true"] {
    background: var(--lr-segmented-selected-bg, var(--lr-color-surface));
    color: var(--lr-segmented-selected-color, var(--lr-color-text));
    font-weight: var(
      --lr-segmented-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
    /* Smallest step in the scale: the checked segment is a thumb lifted a hair off its own track,
       the shallowest resting chrome the library has. */
    box-shadow: var(--lr-segmented-selected-shadow, var(--lr-shadow-xs));
  }
  @media (forced-colors: active) {
    [part="base"][data-scroll-overflow],
    :host(:dir(rtl)) [part="base"][data-scroll-overflow] {
      -webkit-mask-image: none;
      mask-image: none;
    }
  }
`;
