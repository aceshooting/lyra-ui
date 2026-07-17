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
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-brand-quiet);
    outline: var(--lyra-border-width-thin) solid var(--lyra-color-brand);
    outline-offset: calc(-1 * var(--lyra-border-width-thin));
  }
  :host([interactive]) [part='rect'] {
    pointer-events: auto;
    cursor: pointer;
  }
  [part='rect'][data-tone='success'] {
    background: var(--lyra-color-success-quiet);
    outline-color: var(--lyra-color-success);
  }
  [part='rect'][data-tone='warning'] {
    background: var(--lyra-color-warning-quiet);
    outline-color: var(--lyra-color-warning);
  }
  [part='rect'][data-tone='danger'] {
    background: var(--lyra-color-danger-quiet);
    outline-color: var(--lyra-color-danger);
  }
  [part='rect'][data-tone='neutral'] {
    background: var(--lyra-color-surface-raised);
    outline-color: var(--lyra-color-text-quiet);
  }
  [part='rect'][data-active] {
    outline-width: var(--lyra-border-width-medium);
  }
  [part='rect']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='rect'][data-flash] {
    background: var(--lyra-color-brand);
    animation: lyra-highlight-layer-flash var(--lyra-transition-ambient);
  }
  @keyframes lyra-highlight-layer-flash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='rect'][data-flash] {
      animation: none;
      outline-width: var(--lyra-border-width-medium);
    }
  }
`;
