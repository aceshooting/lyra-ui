import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it without a raw literal
       leaking into the public API, same rationale as lr-dialog's own --lr-dialog-overlay-color. */
    --lr-tour-backdrop-color: var(--lr-color-overlay);
    --lr-tour-spotlight-radius: var(--lr-radius);
    --lr-tour-spotlight-ring-color: var(--lr-color-brand);
    --lr-tour-spotlight-ring-width: var(--lr-border-width-medium);
    --lr-tour-popover-max-width: var(--lr-size-22rem);
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
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
    fill: var(--lr-tour-backdrop-color);
  }
  [part='backdrop'] .cutout {
    rx: var(--lr-tour-spotlight-radius);
  }
  [part='spotlight'] {
    position: fixed;
    box-sizing: border-box;
    pointer-events: none;
    border: var(--lr-tour-spotlight-ring-width) solid var(--lr-tour-spotlight-ring-color);
    border-radius: var(--lr-tour-spotlight-radius);
  }
  [part='spotlight'][hidden] {
    display: none;
  }
  [part='popover'] {
    position: fixed;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
    max-inline-size: min(92vw, var(--lr-tour-popover-max-width), var(--lr-positioner-available-inline-size, 100vw));
    max-block-size: var(--lr-positioner-available-block-size, 90vh);
    padding: var(--lr-space-l);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    pointer-events: auto;
    overflow: auto;
  }
  [part='popover'][data-unanchored] {
    inset: 0;
    margin: auto;
    inline-size: fit-content;
    block-size: fit-content;
    max-inline-size: min(92vw, var(--lr-tour-popover-max-width));
  }
  [part='heading'] {
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-lg);
  }
  [part='body'] {
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
  }
  [part='progress'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='progress-text'] {
    white-space: nowrap;
  }
  .dots {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='progress-dot'] {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
  }
  [part='progress-dot'][data-current] {
    background: var(--lr-color-brand);
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
  }
  [part='previous-button'],
  [part='skip-button'],
  [part='next-button'] {
    font: inherit;
    font-size: var(--lr-font-size-md-sm);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border-radius: var(--lr-radius);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='previous-button'] {
    margin-inline-end: auto;
  }
  [part='previous-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='next-button'] {
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    border-color: var(--lr-color-brand);
  }
  [part='previous-button']:hover:not(:disabled),
  [part='skip-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='next-button']:hover {
    filter: brightness(1.08);
  }
  [part='previous-button']:focus-visible,
  [part='skip-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @media (prefers-reduced-motion: no-preference) {
    [part='popover'] {
      animation: lr-tour-popover-in var(--lr-transition-base) both;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='popover'] {
      animation: none;
    }
  }
  @keyframes lr-tour-popover-in {
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
