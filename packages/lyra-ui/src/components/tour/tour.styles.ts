import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it without a raw literal
       leaking into the public API, same rationale as lyra-dialog's own --lyra-dialog-overlay-color. */
    --lyra-tour-backdrop-color: var(--lyra-color-overlay);
    --lyra-tour-spotlight-radius: var(--lyra-radius);
    --lyra-tour-spotlight-ring-color: var(--lyra-color-brand);
    --lyra-tour-spotlight-ring-width: var(--lyra-border-width-medium);
    --lyra-tour-popover-max-width: var(--lyra-size-22rem);
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
    display: none;
    pointer-events: none;
  }
  :host([open]) {
    display: block;
  }
  [part='backdrop'] {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }
  [part='backdrop'] .scrim {
    fill: var(--lyra-tour-backdrop-color);
  }
  [part='backdrop'] .cutout {
    rx: var(--lyra-tour-spotlight-radius);
  }
  [part='spotlight'] {
    position: fixed;
    box-sizing: border-box;
    pointer-events: none;
    border: var(--lyra-tour-spotlight-ring-width) solid var(--lyra-tour-spotlight-ring-color);
    border-radius: var(--lyra-tour-spotlight-radius);
  }
  [part='spotlight'][hidden] {
    display: none;
  }
  [part='popover'] {
    position: fixed;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-m);
    min-inline-size: 0;
    max-inline-size: min(92vw, var(--lyra-tour-popover-max-width), var(--lyra-positioner-available-inline-size, 100vw));
    max-block-size: var(--lyra-positioner-available-block-size, 90vh);
    padding: var(--lyra-space-l);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    pointer-events: auto;
    overflow: auto;
  }
  [part='popover'][data-unanchored] {
    inset: 0;
    margin: auto;
    inline-size: fit-content;
    block-size: fit-content;
    max-inline-size: min(92vw, var(--lyra-tour-popover-max-width));
  }
  [part='heading'] {
    font-weight: var(--lyra-font-weight-semibold);
    font-size: var(--lyra-font-size-lg);
  }
  [part='body'] {
    color: var(--lyra-color-text);
    overflow-wrap: anywhere;
  }
  [part='progress'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
  [part='progress-text'] {
    white-space: nowrap;
  }
  .dots {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='progress-dot'] {
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border);
  }
  [part='progress-dot'][data-current] {
    background: var(--lyra-color-brand);
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
  }
  [part='previous-button'],
  [part='skip-button'],
  [part='next-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-md-sm);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    border-radius: var(--lyra-radius);
    cursor: pointer;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
  }
  [part='previous-button'] {
    margin-inline-end: auto;
  }
  [part='previous-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='next-button'] {
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
    border-color: var(--lyra-color-brand);
  }
  [part='previous-button']:hover:not(:disabled),
  [part='skip-button']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='next-button']:hover {
    filter: brightness(1.08);
  }
  [part='previous-button']:focus-visible,
  [part='skip-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  @media (prefers-reduced-motion: no-preference) {
    [part='popover'] {
      animation: lyra-tour-popover-in var(--lyra-transition-base) both;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='popover'] {
      animation: none;
    }
  }
  @keyframes lyra-tour-popover-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;
