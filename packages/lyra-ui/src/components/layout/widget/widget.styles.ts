import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Fullscreen scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through). */
    --lr-widget-overlay-color: var(--lr-color-overlay);
    --lr-widget-fullscreen-inset:
      max(var(--lr-space-l), var(--lr-safe-area-top))
      max(var(--lr-space-l), var(--lr-safe-area-inline-end))
      max(var(--lr-space-l), var(--lr-safe-area-bottom))
      max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    --lr-widget-backdrop-inset: var(--lr-widget-fullscreen-inset);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='title'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  [part='icon'][hidden] {
    display: none;
  }
  [part='label-group'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='label'],
  [part='sublabel'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='label'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='sublabel'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='label'][hidden],
  [part='sublabel'][hidden] {
    display: none;
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='view-toggles'] {
    display: flex;
    gap: var(--lr-space-2xs);
  }
  [part='view-toggle'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    cursor: pointer;
  }
  [part='view-toggle'][aria-pressed='true'] {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
    border-color: transparent;
  }
  [part='view-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='collapse-button'],
  [part='fullscreen-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
    transition: transform var(--lr-transition-fast);
  }
  [part='collapse-button']:hover,
  [part='fullscreen-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='collapse-button']:focus-visible,
  [part='fullscreen-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Chevron points at the content: rotated (pointing down) while expanded, resting (pointing right)
     while collapsed -- same convention as lr-code-block's/lr-json-viewer's own toggles. */
  :host(:not([collapsed])) [part='collapse-button'] {
    transform: rotate(90deg);
  }
  /* RTL: the resting (collapsed) chevron mirrors to point left -- the conventional mirrored
     disclosure-triangle direction for RTL. Scoped to [collapsed] specifically (rather than a plain
     :dir(rtl) rule) so it never competes with the rule above for the expanded state, which needs no
     mirroring: rotating this left-right-asymmetric glyph 90deg already produces a symmetric chevron. */
  :host([collapsed]:dir(rtl)) [part='collapse-button'] {
    transform: scaleX(-1);
  }
  [part='body'] {
    padding: var(--lr-space-m);
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='body'][hidden] {
    display: none;
  }
  [part='backdrop'] {
    position: fixed;
    inset: var(--lr-widget-backdrop-inset, 0);
    background: var(--lr-widget-overlay-color);
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
  }
  :host([fullscreen]) [part='base'] {
    position: fixed;
    inset: var(--lr-widget-fullscreen-inset, 0);
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-modal)) + 1);
    box-shadow: var(--lr-shadow);
  }
  :host([fullscreen]) [part='body'] {
    overflow: auto;
    block-size: 100%;
  }
  :host([compact]) [part='header'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  :host([compact]) [part='body'] {
    padding: var(--lr-space-s);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='collapse-button'],
    [part='fullscreen-button'] {
      transition: none !important;
    }
  }
`;
