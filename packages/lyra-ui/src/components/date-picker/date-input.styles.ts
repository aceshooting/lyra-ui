import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: 0.875rem;
    font-weight: 600;
  }
  [part='form-control-label']:empty {
    display: none;
  }
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='input-wrapper']:focus-within {
    border-color: var(--lyra-color-brand);
  }
  :host([disabled]) [part='input-wrapper'] {
    opacity: 0.5;
  }
  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }
  [part='clear-button'],
  [part='expand-button'] {
    flex: 0 0 auto;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    padding: 0 var(--lyra-space-xs);
    line-height: 1;
    font-size: 1rem;
  }
  [part='popup'] {
    display: none;
    position: fixed;
    z-index: 900;
  }
  :host([open]) [part='popup'] {
    display: block;
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='hint']:empty {
    display: none;
  }
`;
