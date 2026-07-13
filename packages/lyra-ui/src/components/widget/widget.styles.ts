import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Fullscreen scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through). */
    --lyra-widget-overlay-color: var(--lyra-color-overlay);
    --lyra-widget-fullscreen-inset:
      max(var(--lyra-space-l), var(--lyra-safe-area-top))
      max(var(--lyra-space-l), var(--lyra-safe-area-inline-end))
      max(var(--lyra-space-l), var(--lyra-safe-area-bottom))
      max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='title'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
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
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='sublabel'] {
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='view-toggles'] {
    display: flex;
    gap: var(--lyra-space-2xs);
  }
  [part='view-toggle'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-2xs);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: var(--lyra-font-size-sm);
    cursor: pointer;
  }
  [part='view-toggle'][aria-pressed='true'] {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
    border-color: transparent;
  }
  [part='view-toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='collapse-button'],
  [part='fullscreen-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    background: transparent;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
    cursor: pointer;
    transition: transform var(--lyra-transition-fast);
  }
  [part='collapse-button']:hover,
  [part='fullscreen-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='collapse-button']:focus-visible,
  [part='fullscreen-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='body'] {
    padding: var(--lyra-space-m);
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='body'][hidden] {
    display: none;
  }
  [part='backdrop'] {
    position: fixed;
    inset: var(--lyra-widget-fullscreen-inset, 0);
    background: var(--lyra-widget-overlay-color);
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
  }
  :host([fullscreen]) [part='base'] {
    position: fixed;
    inset: var(--lyra-widget-fullscreen-inset);
    z-index: calc(var(--lyra-overlay-stack-index, var(--lyra-layer-modal)) + 1);
    box-shadow: var(--lyra-shadow);
  }
  :host([fullscreen]) [part='body'] {
    overflow: auto;
    block-size: 100%;
  }
  :host([compact]) [part='header'] {
    padding: var(--lyra-space-xs) var(--lyra-space-s);
  }
  :host([compact]) [part='body'] {
    padding: var(--lyra-space-s);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='collapse-button'],
    [part='fullscreen-button'] {
      transition: none !important;
    }
  }
`;
