import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lr-font-size-sm);
    /* Consumer-tunable scroll cap -- 'none' means the component grows with its content until a
       caller opts into an internal scrollbar via the max-height attribute. */
    --lr-stack-trace-max-height: none;
    --lr-stack-trace-font: var(--lr-font-mono);
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lr-stack-trace-max-height);
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    padding: var(--lr-space-s);
  }
  [part='message'] {
    font-weight: var(--lr-font-weight-bold);
    margin-block-end: var(--lr-space-s);
    overflow-wrap: anywhere;
  }
  [part='group'] {
    margin-block-end: var(--lr-space-s);
    font-family: var(--lr-stack-trace-font);
  }
  [part='group']:last-child {
    margin-block-end: 0;
  }
  [part='frame'] {
    display: block;
    inline-size: 100%;
    text-align: start;
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: var(--lr-space-2xs) 0;
    cursor: pointer;
  }
  [part='frame'][data-internal] {
    color: var(--lr-color-text-quiet);
  }
  [part='frame']:hover,
  [part='frame']:focus-visible {
    color: var(--lr-color-brand);
  }
  [part='frame']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='frame-function'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='frame-location'] {
    color: var(--lr-color-text-quiet);
    margin-inline-start: var(--lr-space-xs);
    overflow-wrap: anywhere;
  }
  [part='internal-toggle'] {
    display: block;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-brand);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--lr-space-2xs) 0;
  }
  [part='internal-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='raw'] {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--lr-stack-trace-font);
  }
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    cursor: pointer;
    margin-block-end: var(--lr-space-s);
  }
  [part='copy-button']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
