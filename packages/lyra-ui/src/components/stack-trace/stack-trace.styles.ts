import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lyra-font-size-sm);
    /* Consumer-tunable scroll cap -- 'none' means the component grows with its content until a
       caller opts into an internal scrollbar via the max-height attribute. */
    --lyra-stack-trace-max-height: none;
    --lyra-stack-trace-font: var(--lyra-font-mono);
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lyra-stack-trace-max-height);
    overflow: auto;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    padding: var(--lyra-space-s);
  }
  [part='message'] {
    font-weight: var(--lyra-font-weight-bold);
    margin-block-end: var(--lyra-space-s);
    overflow-wrap: anywhere;
  }
  [part='group'] {
    margin-block-end: var(--lyra-space-s);
    font-family: var(--lyra-stack-trace-font);
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
    padding: var(--lyra-space-2xs) 0;
    cursor: pointer;
  }
  [part='frame'][data-internal] {
    color: var(--lyra-color-text-quiet);
  }
  [part='frame']:hover,
  [part='frame']:focus-visible {
    color: var(--lyra-color-brand);
  }
  [part='frame']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='frame-function'] {
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='frame-location'] {
    color: var(--lyra-color-text-quiet);
    margin-inline-start: var(--lyra-space-xs);
    overflow-wrap: anywhere;
  }
  [part='internal-toggle'] {
    display: block;
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-brand);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--lyra-space-2xs) 0;
  }
  [part='internal-toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='raw'] {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--lyra-stack-trace-font);
  }
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    cursor: pointer;
    margin-block-end: var(--lyra-space-s);
  }
  [part='copy-button']:hover {
    border-color: var(--lyra-color-brand);
  }
  [part='copy-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
