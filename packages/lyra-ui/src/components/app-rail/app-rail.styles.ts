import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Component-specific sizing -- not shared design tokens, so a consumer
       can retheme any of them without a raw literal leaking into the public
       API (same rationale as lyra-dialog's --lyra-dialog-overlay-color and
       lyra-widget's --lyra-widget-overlay-color). */
    --lyra-app-rail-width: var(--lyra-size-15rem);
    --lyra-app-rail-icon-width: var(--lyra-size-4rem);
    --lyra-app-rail-mobile-width: var(--lyra-size-18rem);
    --lyra-app-rail-overlay-color: var(--lyra-color-overlay);
  }

  [part='toggle'] {
    display: none;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  :host([mode='mobile']) [part='toggle'] {
    display: inline-flex;
  }
  :host([hide-toggle][mode='mobile']) [part='toggle'] {
    display: none;
  }
  [part='toggle']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='backdrop'] {
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
    background: var(--lyra-app-rail-overlay-color);
  }

  /* [part="base"]/[part="panel"] are the SAME element -- this
     component promotes it in place for the mobile overlay (mirrors
     lyra-widget's fullscreen mode) rather than duplicating the slotted nav
     content into a second element, which slot projection can't do anyway
     (a light-DOM node can only be assigned to one <slot> at a time). Its
     part attribute switches between the two names per render, so the two
     rulesets below are always mutually exclusive on it. */
  [part='base'] {
    position: relative; /* anchors [part="resizer"] */
    display: flex;
    flex-direction: column;
    inline-size: var(--lyra-app-rail-width);
    block-size: 100%;
    border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    padding-block-end: var(--lyra-safe-area-bottom);
    overflow-y: auto;
    transition: inline-size var(--lyra-transition-base);
  }
  :host([mode='icon-only']) [part='base'] {
    inline-size: var(--lyra-app-rail-icon-width);
  }
  :host([dragging]) [part='base'] {
    transition: none;
  }

  /* The interactive hit target meets the shared minimum tappable size (same --lyra-icon-button-size
     floor as lyra-code-block's/lyra-json-viewer's [part='toggle'] and lyra-swatch-picker's
     [part='swatch']), centered on the same inset-inline-end edge the old 3px-wide box occupied --
     while the *visible* drag line stays a slim 3px bar, rendered on the separate [part='resizer-track']
     child below and centered via flex, not by resizing this element itself. */
  [part='resizer'] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: calc(var(--lyra-icon-button-size) * -0.5);
    inline-size: var(--lyra-icon-button-size);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    display: flex;
    align-items: stretch;
    justify-content: center;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
  }
  [part='resizer-track'] {
    inline-size: var(--lyra-size-3px);
    background: transparent;
    transition: background-color var(--lyra-transition-fast);
  }
  [part='resizer']:hover [part='resizer-track'] {
    background: var(--lyra-color-brand);
  }
  [part='resizer']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='panel'] {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: calc(var(--lyra-overlay-stack-index, var(--lyra-layer-modal)) + 1);
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lyra-app-rail-mobile-width), 85vw);
    background: var(--lyra-color-surface);
    padding-block-end: var(--lyra-safe-area-bottom);
    box-shadow: var(--lyra-shadow);
    overflow-y: auto;
    transform: translateX(-100%);
    transition: transform var(--lyra-transition-base);
  }
  /* translateX is a physical transform -- CSS logical properties don't cover
     it -- so the offscreen direction is flipped explicitly for RTL via
     :dir() rather than needing internal/rtl.ts's JS helper (that helper is
     for pointer/keyboard math that can't be expressed in CSS at all; this
     can). */
  :host(:dir(rtl)) [part='panel'] {
    transform: translateX(100%);
  }
  :host([mode='mobile'][open]) [part='panel'] {
    transform: translateX(0);
  }

  [part='header'] {
    padding: var(--lyra-space-m);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='footer'] {
    padding: var(--lyra-space-m);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='footer'][hidden] {
    display: none;
  }
  [part='nav'] {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: var(--lyra-space-s);
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  :host([mode='icon-only']) [part='nav'] {
    align-items: center;
  }
  :host([mode='icon-only']) ::slotted(lyra-app-rail-item) {
    max-inline-size: var(--lyra-app-rail-icon-width);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='panel'],
    [part='resizer-track'] {
      transition: none !important;
    }
  }
`;
