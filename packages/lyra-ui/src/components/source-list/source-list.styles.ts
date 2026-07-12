import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: none;
    background: none;
    color: var(--lyra-color-text);
    font: inherit;
    font-weight: 600;
    font-size: 0.875rem;
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lyra-transition-fast);
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    padding: 0 var(--lyra-space-m) var(--lyra-space-m);
    border-block-start: 1px solid var(--lyra-color-border);
    padding-block-start: var(--lyra-space-m);
  }
  [part='list'][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] {
      transition: none !important;
    }
  }
`;
