import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Fullscreen scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through). */
    --lyra-widget-overlay-color: rgb(0 0 0 / 0.5);
    --lyra-widget-fullscreen-inset: var(--lyra-space-l);
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-block-end: 1px solid var(--lyra-color-border);
  }
  [part='title'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='label'],
  [part='sublabel'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='label'] {
    font-weight: 600;
  }
  [part='sublabel'] {
    font-size: 0.8125rem;
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
    z-index: var(--lyra-overlay-stack-index, 1000);
  }
  :host([fullscreen]) [part='base'] {
    position: fixed;
    inset: var(--lyra-widget-fullscreen-inset);
    z-index: calc(var(--lyra-overlay-stack-index, 1000) + 1);
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
