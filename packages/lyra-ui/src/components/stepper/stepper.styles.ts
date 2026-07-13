import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    gap: var(--lyra-space-m);
    overflow-x: auto;
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    overflow-x: visible;
  }
  [part='step'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 0 0 auto;
    border: none;
    background: transparent;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    cursor: pointer;
    padding: var(--lyra-space-2xs);
    border-radius: var(--lyra-radius);
  }
  [part='step'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='step']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='step'][data-state='current'] {
    color: var(--lyra-color-text);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='step'][data-state='error'] {
    color: var(--lyra-color-danger);
  }
  [part='step-index'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-1-5rem);
    block-size: var(--lyra-size-1-5rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-xs);
    flex: 0 0 auto;
  }
  [part='step'][data-state='current'] [part='step-index'] {
    background: var(--lyra-color-brand);
    color: var(--lyra-color-surface);
  }
  [part='step-check'] {
    color: var(--lyra-color-success);
    flex: 0 0 auto;
  }
  [part='step-label'] {
    white-space: nowrap;
  }
`;
