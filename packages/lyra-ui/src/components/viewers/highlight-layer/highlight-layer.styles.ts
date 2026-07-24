import { css } from 'lit';

export const styles = css`
  :host {
    position: absolute;
    inset: 0;
    display: block;
    pointer-events: none;
  }
  [part='base'] {
    position: absolute;
    inset: 0;
  }
  [part='rect'] {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-brand-quiet);
    outline: var(--lr-border-width-thin) solid var(--lr-color-brand);
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }
  [part='rect-target'] {
    position: absolute;
    z-index: var(--lr-layer-content);
    box-sizing: border-box;
    pointer-events: auto;
    cursor: pointer;
    transform: translate(-50%, -50%);
  }
  [part='rect-target']:hover + [part='rect'] {
    outline-width: var(--lr-border-width-medium);
  }
  [part='rect']:where([data-tone='success']) {
    background: var(--lr-color-success-quiet);
    outline-color: var(--lr-color-success);
  }
  [part='rect']:where([data-tone='warning']) {
    background: var(--lr-color-warning-quiet);
    outline-color: var(--lr-color-warning);
  }
  [part='rect']:where([data-tone='danger']) {
    background: var(--lr-color-danger-quiet);
    outline-color: var(--lr-color-danger);
  }
  [part='rect']:where([data-tone='neutral']) {
    background: var(--lr-color-surface-raised);
    outline-color: var(--lr-color-text-quiet);
  }
  [part='rect']:where([data-active]) {
    outline-width: var(--lr-border-width-medium);
  }
  [part='rect-target']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='rect']:where([data-flash]) {
    background: var(--lr-color-brand);
    animation: lr-highlight-layer-flash var(--lr-transition-ambient);
  }
  @keyframes lr-highlight-layer-flash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='rect']:where([data-flash]) {
      animation: none;
      outline-width: var(--lr-border-width-medium);
    }
  }
`;
