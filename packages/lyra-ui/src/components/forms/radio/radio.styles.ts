import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([disabled]) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='circle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    inline-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    block-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    transition: border-color var(--lr-transition-fast), background-color var(--lr-transition-fast);
  }
  :host(:not([disabled])) [part='base']:hover [part='circle'] {
    border-color: var(--lr-color-brand);
  }
  :host([checked]) [part='circle'] {
    border-color: var(--lr-color-brand);
  }
  [part='dot'] {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand);
  }
  [part='label'][hidden] {
    display: none;
  }
  [part='label'] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='circle'] { transition: none !important; }
  }
`;
