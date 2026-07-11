import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    position: relative;
  }
  [part='trigger'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='trigger']:hover:not(:disabled) {
    border-color: var(--lyra-color-brand);
  }
  [part='trigger']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='trigger']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='menu'] {
    display: none;
    position: fixed;
    z-index: 900;
    min-inline-size: 8rem;
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    opacity: 0;
    transform: translateY(-4px);
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast);
  }
  :host([open]) [part='menu'] {
    display: block;
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='menu'] {
      transition: none;
    }
  }
  [part='menu-item'] {
    display: block;
    inline-size: 100%;
    text-align: start;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    border-radius: var(--lyra-radius);
  }
  [part='menu-item']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='menu-item']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
