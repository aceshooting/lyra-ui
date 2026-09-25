import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Containing block for the SIBLING [part="resizer"], which [part="base"]'s own
       position: relative cannot anchor. Without it the absolute resizer resolves inset-block:0
       against the viewport: full viewport height, offscreen. */
    position: relative;
    /* Component-specific sizing, not shared design tokens: rethemeable without a raw literal
       leaking into the public API, like lr-dialog's --lr-dialog-overlay-color and lr-widget's
       --lr-widget-overlay-color. */
    --_lr-app-rail-width: var(--lr-size-15rem);
    --_lr-app-rail-icon-width: var(--lr-size-4rem);
    --_lr-app-rail-mobile-width: var(--lr-size-18rem);
    --_lr-app-rail-overlay-color: var(--lr-color-overlay);
  }

  [part="toggle"] {
    display: none;
    align-items: center;
    justify-content: center;
    font: inherit;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  :host([mode="mobile"]) [part="toggle"] {
    display: inline-flex;
  }
  :host([hide-toggle][mode="mobile"]) [part="toggle"] {
    display: none;
  }
  :host([mode="mobile"][open]) [part="toggle"] {
    position: relative;
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 2);
  }
  /* Reparented into [part="panel"] (see app-rail.class.ts's placeToggle()) for exactly as long as
     the mobile overlay is open, so the shared focus trap -- scoped to the panel alone -- can reach
     it. A dedicated reserved row ahead of the header slot, never absolutely overlaid on top of it,
     so a wide/slotted header stays fully visible instead of being obscured by the close control. */
  [part="panel"] > [part="toggle"] {
    align-self: flex-end;
    flex: 0 0 auto;
    margin-block-start: var(--lr-space-s);
    margin-inline-end: var(--lr-space-s);
  }
  /* hide-toggle only suppresses the OUTSIDE trigger (redundant once a consumer wires an external
     trigger via the trigger/for properties) -- once reparented inside the trapped panel it is the
     ONLY in-panel dismiss control, so it has to survive hide-toggle instead of leaving the open
     panel with no in-panel close affordance at all. This selector out-specifies the hiding rule
     above by one compound (adding [part="panel"] >), so it always wins while both conditions
     hold. */
  :host([hide-toggle][mode="mobile"]) [part="panel"] > [part="toggle"] {
    display: inline-flex;
  }
  [part="toggle"]:hover {
    background: var(--lr-app-rail-toggle-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-toggle-hover-color, var(--lr-color-brand));
  }
  /* The hover fill mixed further toward --lr-color-mix-partner (the text colour), so the pressed
     step is always deeper than the hover step whichever way the theme runs. */
  [part="toggle"]:active {
    background: var(
      --lr-app-rail-toggle-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-app-rail-toggle-active-color, var(--lr-color-brand));
  }
  [part="toggle"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="backdrop"] {
    position: fixed;
    inset-block-start: var(--lr-app-rail-panel-inset-block-start, 0);
    inset-block-end: 0;
    inset-inline: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    background: var(
      --lr-app-rail-overlay-color,
      var(--_lr-app-rail-overlay-color)
    );
  }

  /* [part="base"] and [part="panel"] are the SAME element, promoted in place for the mobile
     overlay as lr-widget's fullscreen mode does; a second element is impossible anyway, a
     light-DOM node assigning to one <slot> at a time. The part attribute switches names per
     render, so the two rulesets below are mutually exclusive. */
  [part="base"] {
    /* The resizer is anchored by :host (a sibling relationship), not by this element. */
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: var(--lr-app-rail-width, var(--_lr-app-rail-width));
    block-size: 100%;
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    background: var(--lr-app-rail-background, var(--lr-color-surface));
    padding-block-end: var(--lr-safe-area-bottom);
    overflow-y: auto;
    /* Pin the cross axis: with only overflow-y set, overflow-x computes from visible to auto and
       can add a spurious horizontal scrollbar when slotted header/footer content is wide. */
    overflow-x: clip;
    transition: inline-size var(--lr-transition-base);
  }
  /* The resizer-track below is transparent at rest, so while the resizer renders this edge is the
     only visible mark of that focusable separator (WCAG 2.2 SC 1.4.11) -- it stays on the
     control-grade token, like lr-split-panel's and lr-multi-split's dividers. */
  :host([resizable][mode="full"]) [part="base"] {
    border-inline-end-color: var(--lr-color-border);
  }
  :host([mode="icon-only"]) [part="base"] {
    inline-size: var(--lr-app-rail-icon-width, var(--_lr-app-rail-icon-width));
  }
  :host([dragging]) [part="base"] {
    transition: none;
  }

  /* The hit target takes the shared --lr-icon-button-size floor (as lr-code-block's/
     lr-json-viewer's [part='toggle'] and lr-swatch-picker's [part='swatch'] do), centered on the
     inset-inline-end edge the old 3px box held; the visible drag line stays a 3px bar on the
     separate [part='resizer-track'] child, flex-centered rather than resized. */
  [part="resizer"] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: calc(var(--lr-icon-button-size) * -0.5);
    inline-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    display: flex;
    align-items: stretch;
    justify-content: center;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
  }
  [part="resizer-track"] {
    inline-size: var(--lr-size-3px);
    background: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part="resizer"]:hover [part="resizer-track"] {
    background: var(--lr-app-rail-resizer-hover-bg, var(--lr-color-brand));
  }
  /* The drag itself: pointer capture keeps :active on the resizer for the whole gesture, so the
     track stays at the deeper mix until the pointer is released. */
  [part="resizer"]:active [part="resizer-track"] {
    background: var(
      --lr-app-rail-resizer-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="resizer"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="panel"] {
    position: fixed;
    /* 0 (the default) reproduces the prior flush-with-the-viewport-top edge; a nonzero override
       leaves room for a fixed app bar/status area above the drawer, matching [part="backdrop"]. */
    inset-block-start: var(--lr-app-rail-panel-inset-block-start, 0);
    inset-block-end: 0;
    inset-inline-start: 0;
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 1);
    display: flex;
    flex-direction: column;
    inline-size: min(
      var(--lr-app-rail-mobile-width, var(--_lr-app-rail-mobile-width)),
      85vw
    );
    /* 0 (the default) reproduces the flush-edged drawer described below; pairs naturally with a
       nonzero --lr-app-rail-panel-inset-block-start, which exposes the panel's top corners.
       Direction-aware per-corner overrides below: each defaults to this same uniform token, so an
       unset override reproduces today's four-equal-corner result exactly. The panel is always
       flush against its own inline-start edge (inset-inline-start: 0 below), so the
       -start-start/-end-start corners are the ones a flush drawer typically leaves square, and
       -start-end/-end-end are the ones away from that edge it typically rounds -- logical, so
       both pairs swap physical sides under dir="rtl" with no second rule. */
    border-start-start-radius: var(
      --lr-app-rail-panel-radius-start-start,
      var(--lr-app-rail-panel-radius, 0)
    );
    border-start-end-radius: var(
      --lr-app-rail-panel-radius-start-end,
      var(--lr-app-rail-panel-radius, 0)
    );
    border-end-start-radius: var(
      --lr-app-rail-panel-radius-end-start,
      var(--lr-app-rail-panel-radius, 0)
    );
    border-end-end-radius: var(
      --lr-app-rail-panel-radius-end-end,
      var(--lr-app-rail-panel-radius, 0)
    );
    /* [part="panel"] is this element's mobile OVERLAY promotion (see the [part="base"] note) -- a
       modal drawer over a scrim, hence the modal-panel surface. Docked in the page's flow,
       [part="base"] keeps --lr-color-surface: resting chrome, not an overlay. */
    background: var(--lr-app-rail-panel-background, var(--lr-color-surface-overlay));
    padding-block-end: var(--lr-safe-area-bottom);
    /* Modal layer, lower step: an edge-anchored drawer flush with three viewport edges, matching
       lr-drawer rather than a free-floating centered dialog. */
    box-shadow: var(--lr-shadow-l);
    /* Both axes are tokenized together, unlike [part="base"]/[part="nav"]'s plain overflow-x:clip:
       a position: fixed descendant (a popup opened by a slotted/nav-item control, e.g. a slotted
       <lr-select>/<lr-menu>) is clipped by EITHER axis being anything other than visible,
       regardless of that descendant's own containing block -- clipping is a paint-level
       restriction on this box's whole rendered subtree, not a positioning-scheme opt-out. Per the
       CSS overflow spec, a lone visible axis paired with a non-visible one is itself computed as
       auto (still clipping) -- the same "spurious horizontal scrollbar" resolution rule
       [part="base"]'s own overflow-x:clip comment above describes for a single axis, just
       bidirectional here. An affected consumer therefore has to set BOTH tokens to visible
       together to actually stop the clipping, trading away the anti-scrollbar guarantee on the
       axis matching wide slotted content. */
    overflow-block: var(--lr-app-rail-panel-overflow-block, auto);
    overflow-inline: var(--lr-app-rail-panel-overflow-inline, clip);
    transform: translateX(-100%);
    transition: transform var(--lr-transition-base);
  }
  /* translateX is physical and CSS logical properties don't cover it, so RTL flips the offscreen
     direction with :dir() rather than internal/rtl.ts's JS helper -- that helper is for
     pointer/keyboard math CSS can't express at all. */
  :host(:dir(rtl)) [part="panel"] {
    transform: translateX(100%);
  }
  /* Settled open is transform: none, NOT translateX(0): any non-none transform, identity included,
     is a containing block for position: fixed descendants and would trap consumer-slotted
     dropdowns/tooltips in the open panel (lyra-ui positions popups position: fixed via Floating UI,
     not the top layer). translateX(-100%) to none still interpolates: none is the identity. */
  :host([mode="mobile"][open]) [part="panel"] {
    transform: none;
  }

  [part="header"] {
    padding: var(--lr-app-rail-header-padding, var(--lr-space-m));
    /* auto (the default) is min-block-size's own initial value, so unset reproduces today's exact
       height -- including this flex item's own content-based automatic minimum size, which a
       literal 0 would silently discard. Set it to reserve room for header content that mounts or
       resizes asynchronously (e.g. an avatar image). Mirrors --lr-command-palette-search-min-
       height's identical auto-default shape. */
    min-block-size: var(--lr-app-rail-header-min-block-size, auto);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part="header"][hidden] {
    display: none;
  }
  /* Row layout only while the opt-in collapse control is actually rendered, so a rail without it
     keeps [part="header"]'s original block formatting byte-for-byte. */
  :host([collapsible]:not([mode="mobile"])) [part="header"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
  }
  :host([collapsible][mode="icon-only"]) [part="header"] {
    justify-content: center;
  }
  [part="collapse-toggle"] {
    display: inline-flex;
    flex: 0 0 auto;
    /* Pushed to the trailing edge with an auto margin rather than justify-content, so slotted
       header content keeps whatever alignment it had. Logical, so RTL flips it. */
    margin-inline-start: auto;
    align-items: center;
    justify-content: center;
    font: inherit;
    /* Same shared WCAG 2.5.8 floor [part="toggle"] takes. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  :host([collapsible][mode="icon-only"]) [part="collapse-toggle"] {
    margin-inline-start: 0;
  }
  [part="collapse-toggle"]:hover {
    background: var(--lr-app-rail-collapse-toggle-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-app-rail-collapse-toggle-hover-color, var(--lr-color-brand));
  }
  [part="collapse-toggle"]:active {
    background: var(
      --lr-app-rail-collapse-toggle-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-app-rail-collapse-toggle-active-color, var(--lr-color-brand));
  }
  [part="collapse-toggle"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* icons.ts ships one right-pointing chevron and asks callers to rotate the WRAPPING element --
     never a second mirrored glyph. Expanded, the control points at the edge the rail collapses
     toward; collapsed, at the edge it expands toward; both flip under RTL. */
  [part="collapse-icon"] {
    display: inline-flex;
    transform: rotate(180deg);
  }
  /* The collapsed state is read off the control's own rendered aria-expanded rather than a second
     :host() qualifier, so the four orientations stay one readable pair of rules; :where() keeps
     the state qualifier at zero specificity, as the rest of this package's state rules do. */
  [part="collapse-toggle"]:where([aria-expanded="false"]) [part="collapse-icon"] {
    transform: none;
  }
  :host(:dir(rtl)) [part="collapse-icon"] {
    transform: none;
  }
  :host(:dir(rtl)) [part="collapse-toggle"]:where([aria-expanded="false"]) [part="collapse-icon"] {
    transform: rotate(180deg);
  }
  [part="footer"] {
    padding: var(--lr-app-rail-footer-padding, var(--lr-space-m));
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part="footer"][hidden] {
    display: none;
  }
  [part="nav"] {
    flex: 1 1 auto;
    overflow-y: auto;
    /* Pin the cross axis (see [part="base"]): overflow-y alone forces overflow-x to auto. */
    overflow-x: clip;
    /* Unset, each falls back to the same token this rule hard-coded before either property
       existed, so the rail's rest/vertical rhythm is unchanged. */
    padding: var(--lr-app-rail-nav-padding, var(--lr-space-s));
    display: flex;
    flex-direction: column;
    gap: var(--lr-app-rail-nav-gap, var(--lr-space-xs));
  }
  :host([mode="icon-only"]) [part="nav"] {
    align-items: center;
  }
  :host([mode="icon-only"]) ::slotted(lr-app-rail-item) {
    max-inline-size: var(
      --lr-app-rail-icon-width,
      var(--_lr-app-rail-icon-width)
    );
  }

  @media (prefers-reduced-motion: reduce) {
    [part="base"],
    [part="panel"],
    [part="collapse-toggle"],
    [part="resizer-track"] {
      transition: none !important;
    }
  }
`;
