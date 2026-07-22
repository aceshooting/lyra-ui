import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Establishes the containing block for [part="resizer"], which is a SIBLING of [part="base"]
       (not a child), so [part="base"]'s own position: relative cannot anchor it. Without this the
       absolutely-positioned resizer resolves inset-block:0 against the initial containing block
       (the viewport), spanning full viewport height and sitting offscreen. */
    position: relative;
    /* Component-specific sizing -- not shared design tokens, so a consumer
       can retheme any of them without a raw literal leaking into the public
       API (same rationale as lr-dialog's --lr-dialog-overlay-color and
       lr-widget's --lr-widget-overlay-color). */
    --lr-app-rail-width: var(--lr-size-15rem);
    --lr-app-rail-icon-width: var(--lr-size-4rem);
    --lr-app-rail-mobile-width: var(--lr-size-18rem);
    --lr-app-rail-overlay-color: var(--lr-color-overlay);
  }

  [part='toggle'] {
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
  :host([mode='mobile']) [part='toggle'] {
    display: inline-flex;
  }
  :host([hide-toggle][mode='mobile']) [part='toggle'] {
    display: none;
  }
  :host([mode='mobile'][open]) [part='toggle'] {
    position: relative;
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 2);
  }
  [part='toggle']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='backdrop'] {
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    background: var(--lr-app-rail-overlay-color);
  }

  /* [part="base"]/[part="panel"] are the SAME element -- this
     component promotes it in place for the mobile overlay (mirrors
     lr-widget's fullscreen mode) rather than duplicating the slotted nav
     content into a second element, which slot projection can't do anyway
     (a light-DOM node can only be assigned to one <slot> at a time). Its
     part attribute switches between the two names per render, so the two
     rulesets below are always mutually exclusive on it. */
  [part='base'] {
    /* The resizer is anchored by :host (a sibling relationship), not by this element. */
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: var(--lr-app-rail-width);
    block-size: 100%;
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    padding-block-end: var(--lr-safe-area-bottom);
    overflow-y: auto;
    /* Pin the cross axis explicitly: with only overflow-y set, overflow-x computes from visible to
       auto and can add a spurious horizontal scrollbar when slotted header/footer content is wide. */
    overflow-x: clip;
    transition: inline-size var(--lr-transition-base);
  }
  :host([mode='icon-only']) [part='base'] {
    inline-size: var(--lr-app-rail-icon-width);
  }
  :host([dragging]) [part='base'] {
    transition: none;
  }

  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-code-block's/lr-json-viewer's [part='toggle'] and lr-swatch-picker's
     [part='swatch']), centered on the same inset-inline-end edge the old 3px-wide box occupied --
     while the *visible* drag line stays a slim 3px bar, rendered on the separate [part='resizer-track']
     child below and centered via flex, not by resizing this element itself. */
  [part='resizer'] {
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
  [part='resizer-track'] {
    inline-size: var(--lr-size-3px);
    background: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='resizer']:hover [part='resizer-track'] {
    background: var(--lr-color-brand);
  }
  [part='resizer']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='panel'] {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 1);
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-app-rail-mobile-width), 85vw);
    background: var(--lr-color-surface);
    padding-block-end: var(--lr-safe-area-bottom);
    box-shadow: var(--lr-shadow);
    overflow-y: auto;
    /* Pin the cross axis (see [part="base"]): overflow-y alone forces overflow-x to auto. */
    overflow-x: clip;
    transform: translateX(-100%);
    transition: transform var(--lr-transition-base);
  }
  /* translateX is a physical transform -- CSS logical properties don't cover
     it -- so the offscreen direction is flipped explicitly for RTL via
     :dir() rather than needing internal/rtl.ts's JS helper (that helper is
     for pointer/keyboard math that can't be expressed in CSS at all; this
     can). */
  :host(:dir(rtl)) [part='panel'] {
    transform: translateX(100%);
  }
  /* Settled-open state is transform: none, NOT translateX(0): a non-none transform (even the
     identity) establishes a containing block for position: fixed descendants, which would trap and
     clip consumer-slotted dropdowns/tooltips inside the open mobile panel (lyra-ui positions popups
     with position: fixed via Floating UI, not the top layer). Transitions between translateX(-100%)
     and none are well-defined (none interpolates as the identity matrix), so the slide-in still
     animates. */
  :host([mode='mobile'][open]) [part='panel'] {
    transform: none;
  }

  [part='header'] {
    padding: var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='footer'] {
    padding: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
  [part='nav'] {
    flex: 1 1 auto;
    overflow-y: auto;
    /* Pin the cross axis (see [part="base"]): overflow-y alone forces overflow-x to auto. */
    overflow-x: clip;
    padding: var(--lr-space-s);
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  :host([mode='icon-only']) [part='nav'] {
    align-items: center;
  }
  :host([mode='icon-only']) ::slotted(lr-app-rail-item) {
    max-inline-size: var(--lr-app-rail-icon-width);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='panel'],
    [part='resizer-track'] {
      transition: none !important;
    }
  }
`;
