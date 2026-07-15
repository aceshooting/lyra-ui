import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([disabled]) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='circle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    box-sizing: border-box;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    transition: border-color var(--lyra-transition-fast), background-color var(--lyra-transition-fast);
  }
  :host(:not([disabled])) [part='base']:hover [part='circle'] {
    border-color: var(--lyra-color-brand);
  }
  :host([checked]) [part='circle'] {
    border-color: var(--lyra-color-brand);
  }
  [part='dot'] {
    inline-size: var(--lyra-size-0-75rem);
    block-size: var(--lyra-size-0-75rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-brand);
  }
  [part='label'][hidden] {
    display: none;
  }
  [part='label'] {
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-md-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='circle'] { transition: none !important; }
  }
`;
