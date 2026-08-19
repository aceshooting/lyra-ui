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
  /* Tablist plus its two overflow controls: an own row lets the controls flank the scroll
     container without becoming children of role="tablist", whose only legal children are tabs.
     min-inline-size: 0 lets the tablist shrink below its content width and scroll at all. */
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
    /* Never shrinks: at the narrow allocations that cause overflow, a shrinkable control would be
       squeezed through the WCAG 2.5.8 floor. */
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
    /* Continues the tablist's own rule so the line under the strip runs unbroken edge to edge. */
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    transition: color var(--lr-transition-fast),
      background var(--lr-transition-fast);
  }
  /* Out of layout, and the accessibility tree with it, until ScrollOverflowController measures
     real overflow -- the same measurement gating the edge fade, so the two affordances cannot
     disagree. :has() on the wrapper is what lets the *preceding* control react to the tablist's
     state attribute: CSS has no previous-sibling combinator. :where() zeroes the qualifier,
     leaving (0,1,0) -- the base [part~='scroll-button'] rule's weight, so source order alone
     decides. */
  :where([part="nav"]:not(:has([part~="tablist"][data-scroll-overflow])))
    [part~="scroll-button"] {
    display: none;
  }
  :where([part~="scroll-button"][hidden]) {
    display: none;
  }
  /* Same treatment as [part="tab"], so the controls read as part of the strip, not as two foreign
     buttons bolted to its ends. */
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
  /* Firefox suppresses native :active when the control's mousedown keeps focus on the tab; this
     short-lived attribute mirrors that state there. Every scroll-button rule is :where()-wrapped
     to (0,1,0), so source order alone decides which state paints. */
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
  /* The controls are tabindex="-1", so focus is script-only -- but it must still be visible. */
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
     it, never the svg. LTR: start points left, end right. RTL: flex mirrors the whole row, so
     inline-start is physically rightward and the mirror moves between the controls rather than
     being added to both. */
  [part~="scroll-button-start"] [part="scroll-button-glyph"] {
    transform: scaleX(-1);
  }
  :host(:dir(rtl)) [part~="scroll-button-start"] [part="scroll-button-glyph"] {
    transform: none;
  }
  :host(:dir(rtl)) [part~="scroll-button-end"] [part="scroll-button-glyph"] {
    transform: scaleX(-1);
  }
  /* Edge affordance gated on real overflow: ScrollOverflowController toggles data-scroll-overflow
     from a scrollWidth/clientWidth measurement; scrolling stays native, with no scroll listener.
     Unconditional, it fades the first and last tab of a row that fits.
     data-scroll-start/data-scroll-end sit in :where() to pin these rules to the plain
     [data-scroll-overflow] baseline, so the later same-selector forced-colors override wins the
     tie on source order rather than leaving the gradient mask painted. */
  [part~="tablist"][data-scroll-overflow]:where([data-scroll-start][data-scroll-end]) {
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
  [part~="tablist"][data-scroll-overflow]:where(
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
  [part~="tablist"][data-scroll-overflow]:where(
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
    [part~="tablist"][data-scroll-overflow]:where(
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
    [part~="tablist"][data-scroll-overflow]:where(
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
  [part="tab"] {
    position: relative;
    appearance: none;
    background: none;
    border: none;
    /* Sits over the tablist's own border-block-end so the selected accent underline replaces it
       pixel for pixel. */
    border-block-end: var(--lr-border-width-medium) solid transparent;
    margin-block-end: var(--lr-size-neg-1px);
    padding: var(--lr-space-s) var(--lr-space-xs);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    white-space: nowrap;
    /* inline-flex matters only when a tab-icon is present -- gap does nothing with a single child,
       so a text-only tab lays out as the plain inline-block button did. */
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
  /* Its own hook, not the shared --lr-color-text token: recoloring the selected tab must never
     repaint hovered-unselected tabs. :where() leaves only :hover, so this is (0,1,0), below the
     [part='tab'][aria-selected='true'] rule's (0,2,0) further down -- the selected tab keeps its
     own colour under the pointer. */
  :where([part="tab"]):hover:where(:not([aria-disabled="true"])) {
    color: var(--lr-tab-group-hover-color, var(--lr-color-text));
  }
  /* Hover lifts only the label colour, so the pressed step adds a surface: the tab's transparent
     fill mixed toward --lr-color-mix-partner, landing as that colour at --lr-color-mix-active
     alpha over whatever the tablist sits on. A disabled tab has pointer-events: none and never
     reaches it. */
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
  /* Inline var() fallbacks rather than :host-declared properties: a :host declaration would shadow
     a value a consumer set on an ancestor. Unset, each falls back to the token the rule used
     before the hooks existed, so the rendering is unchanged. */
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
    /* pointer-events: none matches the click handler, which already no-ops on a disabled tab. */
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
  /* no-pressed-state: the panel is a container for slotted content, not a target -- :active also
     matches the ancestors of whatever was pressed, so clicking any control inside would flash this
     outline around the whole panel. */
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

  /* Placement: the base flex direction moves the strip relative to the panels. start/end are
     logical, so row/row-reverse mirror under RTL with no :dir() rule; a vertical strip trades its
     block-end rule for the matching inline-end one. */
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
  /* A vertical strip renders no scroll controls. Its nav keeps natural width for short labels, may
     shrink, and is capped so one unbroken label cannot consume the panel's entire allocation.
     Inline fallback so consumers can set it on the group or an ancestor. */
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
  /* Deliberately single-line: clipping the visual label keeps a compact side rail, and the full
     label stays the tab's accessible name. */
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
  /* The edge fade measures inline overflow; a vertical strip scrolls in block, so the mask would
     dim the wrong ends. */
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
