import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-s);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='title'] {
    align-self: flex-start;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lyra-color-brand);
    font: inherit;
    font-weight: 600;
    font-size: 0.875rem;
    text-align: start;
    cursor: pointer;
  }
  [part='title']:hover {
    text-decoration: underline;
  }
  [part='title']:focus-visible,
  [part='toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='excerpt'] {
    color: var(--lyra-color-text-quiet);
    font-size: 0.8125rem;
    line-height: 1.4;
  }
  [part='excerpt']:empty {
    display: none;
  }
  [part='toggle'] {
    align-self: flex-start;
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: var(--lyra-color-brand);
    font: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }
  [part='toggle']:hover {
    text-decoration: underline;
  }
  [part='full'] {
    padding-block-start: var(--lyra-space-xs);
    border-block-start: 1px solid var(--lyra-color-border);
    color: var(--lyra-color-text);
    font-size: 0.8125rem;
    line-height: 1.4;
  }
  [part='full'][hidden] {
    display: none;
  }
`;
