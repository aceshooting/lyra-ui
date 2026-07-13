import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-diff-view-font: var(--lyra-font-mono);
  }
  [part='base'] {
    position: relative;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: auto;
  }
  pre {
    margin: 0;
    padding: var(--lyra-space-s);
    font-family: var(--lyra-diff-view-font);
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-snug);
  }
  [part='line'] {
    white-space: pre-wrap;
  }
  [part='line'][data-type='add'] {
    background: var(--lyra-color-success-quiet);
    color: var(--lyra-color-success);
  }
  [part='line'][data-type='remove'] {
    background: var(--lyra-color-danger-quiet);
    color: var(--lyra-color-danger);
  }
  [part='copy-button'] {
    position: absolute;
    inset-block-start: var(--lyra-space-xs);
    inset-inline-end: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-xs);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-s);
    cursor: pointer;
  }
  [part='copy-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
