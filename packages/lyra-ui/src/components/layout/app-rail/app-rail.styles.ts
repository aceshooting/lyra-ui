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
    inset: 0;
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
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    padding-block-end: var(--lr-safe-area-bottom);
    overflow-y: auto;
    /* Pin the cross axis: with only overflow-y set, overflow-x computes from visible to auto and
       can add a spurious horizontal scrollbar when slotted header/footer content is wide. */
    overflow-x: clip;
    transition: inline-size var(--lr-transition-base);
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
    inset-block: 0;
    inset-inline-start: 0;
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 1);
    display: flex;
    flex-direction: column;
    inline-size: min(
      var(--lr-app-rail-mobile-width, var(--_lr-app-rail-mobile-width)),
      85vw
    );
    /* [part="panel"] is this element's mobile OVERLAY promotion (see the [part="base"] note) -- a
       modal drawer over a scrim, hence the modal-panel surface. Docked in the page's flow,
       [part="base"] keeps --lr-color-surface: resting chrome, not an overlay. */
    background: var(--lr-color-surface-overlay);
    padding-block-end: var(--lr-safe-area-bottom);
    /* Modal layer, lower step: an edge-anchored drawer flush with three viewport edges, matching
       lr-drawer rather than a free-floating centered dialog. */
    box-shadow: var(--lr-shadow-l);
    overflow-y: auto;
    /* Pin the cross axis (see [part="base"]): overflow-y alone forces overflow-x to auto. */
    overflow-x: clip;
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
    padding: var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="header"][hidden] {
    display: none;
  }
  [part="footer"] {
    padding: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="footer"][hidden] {
    display: none;
  }
  [part="nav"] {
    flex: 1 1 auto;
    overflow-y: auto;
    /* Pin the cross axis (see [part="base"]): overflow-y alone forces overflow-x to auto. */
    overflow-x: clip;
    padding: var(--lr-space-s);
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
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
    [part="resizer-track"] {
      transition: none !important;
    }
  }
`;
