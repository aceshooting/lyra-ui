import { visuallyHidden } from '../../../internal/a11y.js';
import { forcedColorsPart } from '../../../internal/forced-colors.styles.js';
import { activeFill, focusRingInsetOffset, focusRingInwardOffset, focusRingShorthandInsetPastFrame, focusRingOffsetFrom, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css, unsafeCSS } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
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
    /* The body absorbs block-axis overflow without hiding the horizontal tab strip. */
    flex: none;
    position: relative;
    display: flex;
    align-items: stretch;
    min-inline-size: 0;
    min-block-size: 0;
  }
  /* Keep descriptor CSS measurable without painting, accepting input, or extending scrollable
     document bounds. This box introduces no containment or container-query context. */
  [data-descriptor-staging] {
    position: absolute;
    inset: 0;
    overflow: clip;
    opacity: 0;
    pointer-events: none;
  }
  [part~="tablist"] {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-m);
    border-block-end: var(--track-width, var(--lr-tab-group-track-width, var(--lr-border-width-thin))) solid
      var(--track-color, var(--lr-color-border-subtle));
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part~="tablist"][data-menu-mode] {
    overflow: clip;
    position: relative;
    mask-image: none;
  }
  [data-menu-mode] > button {
    flex: none;
    inline-size: max-content;
  }
  /* Keep slotted rich content in the same measurement context as visible tabs. */
  [data-menu-mode] > [data-measure-only] {
    position: absolute;
    inset-inline-end: 100%;
    inset-block-start: 0;
    clip-path: inset(50%);
    pointer-events: none;
  }
  [part="overflow-trigger"], [part="overflow-item"] {
    ${iconHitTarget}
    appearance: none;
    font: inherit;
    color: var(--lr-color-text);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part="overflow-trigger"] {
    position: relative;
    margin-inline-start: auto;
    padding: var(--lr-tab-group-tab-padding, var(--lr-space-s) var(--lr-space-xs));
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-medium);
  }
  [part="overflow-trigger"]:where([aria-selected="true"]) {
    color: var(--lr-tab-group-selected-color, var(--lr-color-brand));
  }
  [part="overflow-trigger"][hidden] { display: none; }
  [part="overflow-trigger"] [part="active-tab-indicator"] { inset-block-end: 0; }
  [part="overflow-menu"] {
    position: fixed;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
    box-sizing: border-box;
    overflow: auto;
    max-inline-size: var(--lr-positioner-available-inline-size, 100vi);
    max-block-size: var(--lr-positioner-available-block-size, 100vb);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    padding: var(--lr-space-xs);
  }
  [part="overflow-item"] {
    display: block;
    inline-size: 100%;
    text-align: start;
    overflow-wrap: anywhere;
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part="overflow-item"]:where([aria-checked="true"]) { font-weight: var(--lr-font-weight-bold); }
  [part="overflow-item"]:where(:disabled) { opacity: var(--lr-opacity-disabled); }
  [part="overflow-trigger"]:where(:hover),
  [part="overflow-item"]:where(:hover:not(:disabled)) {
    background: var(--lr-color-surface-raised);
  }
  [part="overflow-trigger"]:where(:active),
  [part="overflow-item"]:where(:active:not(:disabled)) {
    background: ${activeFill('transparent')};
  }
  [part="overflow-trigger"]:focus-visible,
  [part="overflow-item"]:focus-visible {
    ${focusRingInwardOffset}
  }
  /* The leading scroll control is present only on horizontal strips using custom controls. */
  :where([part~="scroll-button"]) + [part~="tablist"] {
    scrollbar-width: none;
  }
  :where([part~="scroll-button"]) + [part~="tablist"]::-webkit-scrollbar {
    display: none;
  }
  [part~="tablist"][hidden] { display: none; }
  :where([part~="scroll-button"]) {
    /* Never shrinks: at the narrow allocations that cause overflow, a shrinkable control would be
       squeezed through the WCAG 2.5.8 floor. */
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    inline-size: var(--lr-icon-button-size);
    ${iconHitTarget}
    padding: 0;
    appearance: none;
    background: none;
    border: none;
    font: inherit;
    /* Continues the tablist's own rule so the line under the strip runs unbroken edge to edge. */
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
      ${activeFill('transparent')}
    );
    color: var(--lr-tab-group-scroll-button-active-color, var(--lr-color-text));
  }
  /* Firefox suppresses native :active when the control's mousedown keeps focus on the tab; this
     short-lived attribute mirrors that state there. Every scroll-button rule is :where()-wrapped
     to (0,1,0), so source order alone decides which state paints. */
  :where([part~="scroll-button"]):where([data-pressed]) {
    background: var(
      --lr-tab-group-scroll-button-active-bg,
      ${activeFill('transparent')}
    );
    color: var(--lr-tab-group-scroll-button-active-color, var(--lr-color-text));
  }
  /* The controls are tabindex="-1", so focus is script-only -- but it must still be visible. */
  [part~="scroll-button"]:focus-visible {
    ${focusRingInwardOffset}
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
  [data-close-tab]:not(:focus) {
    ${visuallyHidden}
  }
  [part="tab"] {
    position: relative;
    appearance: none;
    background: none;
    border: none;
    /* Sits over the tablist's own border-block-end so the selected accent underline replaces it
       pixel for pixel. */
    border-block-end: var(--lr-border-width-medium) solid transparent;
    margin-block-end: calc(-1 * var(--track-width, var(--lr-tab-group-track-width, var(--lr-border-width-thin))));
    padding: var(--lr-tab-group-tab-padding, var(--lr-space-s) var(--lr-space-xs));
    min-block-size: var(--lr-tab-group-tab-min-block-size, auto);
    font: inherit;
    font-size: var(--lr-tab-group-tab-font-size, inherit);
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    white-space: nowrap;
    /* Rich lr-tab content and its optional close action share one flex row. */
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    transition: color var(--lr-transition-fast),
      border-color var(--lr-transition-fast),
      background-color var(--lr-transition-fast);
  }
  [data-tab-label] {
    min-inline-size: 0;
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
      ${activeFill('transparent')}
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
  /* The tablist scrolls on both axes and every tab touches its block edges, so an outer ring would
     lose its top and bottom. The ring is drawn inside, stepped past the hairline the tab overhangs
     onto the tablist's clipped rule. */
  [part="tab"]:focus-visible {
    ${focusRingShorthandInsetPastFrame}
    border-radius: var(--lr-radius);
  }
  [part="panel"] {
    min-inline-size: 0;
    padding-block-start: var(--lr-space-xs);
    overflow-wrap: break-word;
  }
  [part="body"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
  }
  :host([fill-body]) [part="body"] {
    overflow: clip;
  }
  :host([fill-body]) [part="panel"] {
    block-size: 100%;
    box-sizing: border-box;
  }
  :host([fill-body]) [part="panel"] ::slotted(${unsafeCSS(tag('tab-panel'))}) {
    --_lr-tab-panel-block-size: 100%;
    block-size: 100%;
    box-sizing: border-box;
  }
  /* no-pressed-state: the panel is a container for slotted content, not a target -- :active also
     matches the ancestors of whatever was pressed, so clicking any control inside would flash this
     outline around the whole panel. */
  [part="panel"]:hover:not(:focus-visible) {
    outline-width: var(
      --lr-tab-group-panel-hover-outline-width,
      var(--lr-border-width-thin)
    );
    outline-style: var(--lr-tab-group-panel-hover-outline-style, solid);
    outline-color: var(
      --lr-tab-group-panel-hover-outline-color,
      var(--lr-color-border)
    );
    ${focusRingOffsetFrom('--lr-tab-group-panel-hover-outline-offset')}
    border-radius: var(--lr-radius);
  }
  /* The panel fills the scrolling body edge to edge, so its focus ring is drawn inside. */
  [part="panel"]:focus-visible {
    ${focusRingInsetOffset}
    border-radius: var(--lr-radius);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="tab"],
    [part="overflow-trigger"],
    [part="overflow-item"],
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
    border-block-start: var(--track-width, var(--lr-tab-group-track-width, var(--lr-border-width-thin))) solid
      var(--track-color, var(--lr-color-border-subtle));
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
  :host([placement="start"]) [data-tab-label],
  :host([placement="end"]) [data-tab-label] {
    display: block;
    flex: 1 1 auto;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :host([placement="start"]) [part~="tablist"] {
    border-inline-end: var(--track-width, var(--lr-tab-group-track-width, var(--lr-border-width-thin))) solid
      var(--track-color, var(--lr-color-border-subtle));
  }
  :host([placement="end"]) [part~="tablist"] {
    border-inline-start: var(--track-width, var(--lr-tab-group-track-width, var(--lr-border-width-thin))) solid
      var(--track-color, var(--lr-color-border-subtle));
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
  ${forcedColorsPart('[part="tab"][aria-selected="true"]')}
`;
