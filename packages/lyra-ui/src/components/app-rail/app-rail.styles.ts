import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Component-specific sizing -- not shared design tokens, so a consumer
       can retheme any of them without a raw literal leaking into the public
       API (same rationale as lyra-dialog's --lyra-dialog-overlay-color and
       lyra-widget's --lyra-widget-overlay-color). */
    --lyra-app-rail-width: 15rem;
    --lyra-app-rail-icon-width: 4rem;
    --lyra-app-rail-mobile-width: 18rem;
    --lyra-app-rail-overlay-color: rgb(0 0 0 / 0.5);
  }

  [part='toggle'] {
    display: none;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  :host([mode='mobile']) [part='toggle'] {
    display: inline-flex;
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
    z-index: 999;
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
    display: flex;
    flex-direction: column;
    inline-size: var(--lyra-app-rail-width);
    block-size: 100%;
    border-inline-end: 1px solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    overflow-y: auto;
    transition: inline-size var(--lyra-transition-base);
  }
  :host([mode='icon-only']) [part='base'] {
    inline-size: var(--lyra-app-rail-icon-width);
  }

  [part='panel'] {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lyra-app-rail-mobile-width), 85vw);
    background: var(--lyra-color-surface);
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
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='footer'] {
    padding: var(--lyra-space-m);
    border-block-start: 1px solid var(--lyra-color-border);
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

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='panel'] {
      transition: none !important;
    }
  }
`;
