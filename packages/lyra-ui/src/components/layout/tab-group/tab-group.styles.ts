import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: 0;
  }
  [part~="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    min-block-size: 0;
    max-block-size: 100%;
    block-size: 100%;
    box-sizing: border-box;
  }
  /* The tablist plus its two overflow controls. A row of its own so the controls can flank the
     scroll container without ever becoming children of role="tablist" (whose only legal children
     are the tabs). min-inline-size: 0 is what lets the tablist shrink below its content width and
     therefore scroll at all. */
  [part="nav"] {
    display: flex;
    align-items: stretch;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part~="tablist"] {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-m);
    border-block-end: var(--track-width, var(--lr-border-width-thin)) solid
      var(--track-color, var(--lr-color-border));
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  :where([part~="scroll-button"]) {
    /* Never shrinks: at the narrow allocations that produce overflow in the first place, a
       shrinkable control would be squeezed straight through the WCAG 2.5.8 floor. */
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    inline-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    appearance: none;
    background: none;
    border: none;
    /* Continues the tablist's own rule across the control, so the line under the strip runs
       unbroken from edge to edge instead of stopping short at each control. */
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    transition: color var(--lr-transition-fast),
      background var(--lr-transition-fast);
  }
  /* The controls exist in the DOM for an overflow that may not exist yet, so they are taken out of
     layout (and out of the accessibility tree with it) until the tablist is measured as actually
     overflowing -- the same ScrollOverflowController measurement the edge fade above is gated on,
     so the two affordances can never disagree. :has() on the wrapper is what lets the *preceding*
     control react to the tablist's own state attribute: CSS has no previous-sibling combinator.
     The whole qualifier sits in :where() so it contributes no specificity, leaving this rule at
     (0,1,0) -- it beats the display above by order alone, and a consumer's own
     ::part(scroll-button) ((0,1,1)) still outranks it without needing !important. */
  :where([part="nav"]:not(:has([part~="tablist"][data-scroll-overflow])))
    [part~="scroll-button"] {
    display: none;
  }
  :where([part~="scroll-button"][hidden]) {
    display: none;
  }
  /* Same treatment as [part="tab"], so the controls read as part of the strip rather than as two
     foreign buttons bolted to its ends. */
  :where([part~="scroll-button"]):where(:hover) {
    color: var(--lr-tab-group-scroll-button-hover-color, var(--lr-color-text));
  }
  :where([part~="scroll-button"]):where(:active) {
    background: var(
      --lr-tab-group-scroll-button-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-tab-group-scroll-button-active-color, var(--lr-color-text));
  }
  /* Firefox suppresses native :active when the control's mousedown keeps focus on the tab. The
     short-lived attribute mirrors that state there. The base and each state selector are wrapped
     in :where(), so source order applies the state without blocking a consumer part override. */
  :where([part~="scroll-button"]):where([data-pressed]) {
    background: var(
      --lr-tab-group-scroll-button-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-tab-group-scroll-button-active-color, var(--lr-color-text));
  }
  /* Reachable only by script (the controls are tabindex="-1"), but a consumer that focuses one must
     still see where focus went. */
  [part~="scroll-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
    border-radius: var(--lr-radius);
  }
  [part="scroll-button-glyph"] {
    display: inline-flex;
    align-items: center;
  }
  /* internal/icons.ts ships one direction-free chevron pointing right; the *wrapping part* points
     it, never the svg. LTR: the start control points left, the end control right. RTL: the whole
     row is mirrored by flex layout, so the meanings swap with it -- "toward the inline start" is
     physically rightward. Hence the mirror moves from one control to the other rather than being
     added to both. */
  [part~="scroll-button-start"] [part="scroll-button-glyph"] {
    transform: scaleX(-1);
  }
  :host(:dir(rtl)) [part~="scroll-button-start"] [part="scroll-button-glyph"] {
    transform: none;
  }
  :host(:dir(rtl)) [part~="scroll-button-end"] [part="scroll-button-glyph"] {
    transform: scaleX(-1);
  }
  /* Edge affordance, gated on the tablist actually overflowing -- ScrollOverflowController toggles
     data-scroll-overflow from a real scrollWidth/clientWidth measurement; scrolling itself stays
     native, with no scroll listener. Painted unconditionally (as it used to be) it fades the first
     and last tab of a row that fits, for no reason. */
  [part~="tablist"][data-scroll-overflow][data-scroll-start][data-scroll-end] {
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
  [part~="tablist"][data-scroll-overflow][data-scroll-end]:not(
      [data-scroll-start]
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
  [part~="tablist"][data-scroll-overflow][data-scroll-start]:not(
      [data-scroll-end]
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
    [part~="tablist"][data-scroll-overflow][data-scroll-end]:not(
      [data-scroll-start]
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
    [part~="tablist"][data-scroll-overflow][data-scroll-start]:not(
      [data-scroll-end]
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
  [part="tab"] {
    position: relative;
    appearance: none;
    background: none;
    border: none;
    /* Sits directly over the tablist's own border-block-end so the accent
       underline below replaces it, pixel for pixel, when selected. */
    border-block-end: var(--lr-border-width-medium) solid transparent;
    margin-block-end: var(--lr-size-neg-1px);
    padding: var(--lr-space-s) var(--lr-space-xs);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    white-space: nowrap;
    /* inline-flex only matters once a tab-icon part is also present (gap
       has no effect with a single child) -- a text-only tab lays out
       identically to the previous plain inline-block button. */
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    transition: color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part="tab-icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  /* Reads its own prop, not the shared --lr-color-text token: recoloring the selected tab must
     never repaint hovered-unselected tabs with the selected color. :where() zeroes the wrapped
     selectors' specificity contribution, leaving only :hover itself -- (0,1,0) total, so a
     consumer's own ::part(tab):hover override ((0,1,1)) always wins without needing !important
     (mirrors lr-attachment-trigger's identical fix). */
  :where([part="tab"]):hover:where(:not([aria-disabled="true"])) {
    color: var(--lr-tab-group-hover-color, var(--lr-color-text));
  }
  /* Hover lifts only the label colour here, so the pressed state adds a surface to be a visible
     step past it: the tab's own transparent fill mixed toward --lr-color-mix-partner, which lands
     as the partner colour at --lr-color-mix-active alpha over whatever the tablist sits on. A
     disabled tab has pointer-events: none and never reaches it. */
  :where([part="tab"]):active:where(:not([aria-disabled="true"])) {
    background: var(
      --lr-tab-group-active-bg,
      color-mix(
        in oklab,
        transparent,
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(
      --lr-tab-group-active-color,
      var(--lr-tab-group-hover-color, var(--lr-color-text))
    );
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor and a :host declaration can never shadow that. Unset, each falls back to the token the
     rule used before the hooks existed, so the rendering is unchanged. */
  [part="tab"][aria-selected="true"] {
    color: var(--lr-tab-group-selected-color, var(--lr-color-brand));
    border-block-end-color: var(
      --indicator-color,
      var(--lr-tab-group-indicator-color, var(--lr-color-brand))
    );
  }
  [part="active-tab-indicator"] {
    position: absolute;
    inset-inline: 0;
    inset-block-end: calc(-1 * var(--lr-border-width-medium));
    block-size: var(--lr-border-width-medium);
    background: var(
      --indicator-color,
      var(--lr-tab-group-indicator-color, var(--lr-color-brand))
    );
    pointer-events: none;
  }
  [part="tab"][aria-disabled="true"] {
    cursor: not-allowed;
    /* No :hover color change and no pointer feedback -- the click handler
       already no-ops on a disabled tab, this just matches it visually. */
    pointer-events: none;
    opacity: var(--lr-opacity-disabled);
  }
  [part="tab"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
    border-radius: var(--lr-radius);
  }
  [part="panel"] {
    min-inline-size: 0;
    padding-block-start: var(--lr-space-xs);
    overflow-wrap: anywhere;
  }
  [part="body"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
  }
  /* no-pressed-state: the panel is a container for whatever the consumer slotted into the tab, not
     a target -- pressing it activates nothing, and :active matches the ancestors of whatever was
     pressed, so a click on any control inside the panel would flash this outline around all of
     it. */
  [part="panel"]:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
    outline-offset: var(--lr-focus-ring-offset);
    border-radius: var(--lr-radius);
  }
  [part="panel"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    border-radius: var(--lr-radius);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="tab"],
    [part~="scroll-button"] {
      transition: none !important;
    }
  }

  /* Placement. The base flex direction moves the strip relative to the panels; start/end are
     logical, so row/row-reverse mirror under RTL with no :dir() rule. A vertical strip trades
     its block-end rule for an inline-end one, in the matching logical direction. */
  :host([placement="bottom"]) [part~="base"] {
    flex-direction: column-reverse;
  }
  :host([placement="bottom"]) [part~="tablist"],
  :host([placement="bottom"]) [part~="scroll-button"] {
    border-block-end: none;
    border-block-start: var(--track-width, var(--lr-border-width-thin)) solid
      var(--track-color, var(--lr-color-border));
  }
  :host([placement="bottom"]) [part="tab"][aria-selected="true"] {
    border-block-end-color: transparent;
  }
  :host([placement="bottom"]) [part="active-tab-indicator"] {
    inset-block-start: calc(-1 * var(--lr-border-width-medium));
    inset-block-end: auto;
  }
  /* A vertical strip renders no scroll controls at all. Its nav keeps its natural width for short
     labels, but is allowed to shrink and capped so one unbroken label cannot consume the panel's
     entire allocation. Keep the fallback inline: consumers can set it on the group or an ancestor. */
  :host([placement="start"]) [part="nav"],
  :host([placement="end"]) [part="nav"] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(
      --lr-tab-group-vertical-nav-max-inline-size,
      var(--lr-size-12rem)
    );
    max-block-size: 100%;
  }
  :host([placement="start"]) [part~="base"],
  :host([placement="end"]) [part~="base"] {
    flex-direction: row;
    align-items: stretch;
  }
  :host([placement="end"]) [part~="base"] {
    flex-direction: row-reverse;
  }
  :host([placement="start"]) [part~="tablist"],
  :host([placement="end"]) [part~="tablist"] {
    flex-direction: column;
    align-items: stretch;
    flex: 1 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
    overflow-x: hidden;
    overflow-y: auto;
    min-block-size: 0;
    max-block-size: 100%;
    border-block-end: none;
  }
  /* The vertical nav is deliberately single-line: clipping the visual label preserves a compact
     side rail while the full label remains the tab's accessible name. */
  :host([placement="start"]) [part="tab"],
  :host([placement="end"]) [part="tab"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([placement="start"]) [part~="tablist"] {
    border-inline-end: var(--track-width, var(--lr-border-width-thin)) solid
      var(--track-color, var(--lr-color-border));
  }
  :host([placement="end"]) [part~="tablist"] {
    border-inline-start: var(--track-width, var(--lr-border-width-thin)) solid
      var(--track-color, var(--lr-color-border));
  }
  /* The horizontal edge fade measures inline overflow; a vertical strip scrolls in the block
     direction instead, so the mask would dim the wrong ends. */
  :host([placement="start"]) [part~="tablist"][data-scroll-overflow],
  :host([placement="end"]) [part~="tablist"][data-scroll-overflow] {
    -webkit-mask-image: none;
    mask-image: none;
  }
  /* The selected-tab indicator runs along whichever edge the panels are on. */
  :host([placement="start"]) [part="tab"][aria-selected="true"],
  :host([placement="end"]) [part="tab"][aria-selected="true"] {
    box-shadow: none;
    border-block-end-color: transparent;
  }
  :host([placement="start"]) [part="tab"][aria-selected="true"] {
    border-inline-end: var(--lr-border-width-thick) solid
      var(
        --indicator-color,
        var(--lr-tab-group-indicator-color, var(--lr-color-brand))
      );
  }
  :host([placement="end"]) [part="tab"][aria-selected="true"] {
    border-inline-start: var(--lr-border-width-thick) solid
      var(
        --indicator-color,
        var(--lr-tab-group-indicator-color, var(--lr-color-brand))
      );
  }
  :host([placement="start"]) [part="active-tab-indicator"] {
    inset-block: 0;
    inset-inline: auto calc(-1 * var(--lr-border-width-thick));
    inline-size: var(--lr-border-width-thick);
    block-size: auto;
  }
  :host([placement="end"]) [part="active-tab-indicator"] {
    inset-block: 0;
    inset-inline: calc(-1 * var(--lr-border-width-thick)) auto;
    inline-size: var(--lr-border-width-thick);
    block-size: auto;
  }
  :host([placement="start"]) [part="panel"],
  :host([placement="end"]) [part="panel"] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  @media (forced-colors: active) {
    [part~="tablist"][data-scroll-overflow],
    :host(:dir(rtl)) [part~="tablist"][data-scroll-overflow] {
      -webkit-mask-image: none;
      mask-image: none;
    }
  }
`;
