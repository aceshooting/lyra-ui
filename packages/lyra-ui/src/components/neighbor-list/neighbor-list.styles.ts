import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding-block: var(--lyra-space-xs);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='node-label'] {
    flex: 1 1 auto;
    display: flex;
    align-items: baseline;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
    padding: var(--lyra-size-2px) 0;
    border: none;
    background: transparent;
    color: var(--lyra-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='node-label']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='direction'] {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
  }
  [part='relation'] {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }
  [part='node-meta'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='expand-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Keep the glyph compact while giving the interactive box the shared minimum target size --
       same split as lyra-code-block's own [part='toggle']. */
    inline-size: var(--lyra-size-1-25rem);
    block-size: var(--lyra-size-1-25rem);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    border-radius: var(--lyra-radius-xs);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
  }
  [part='expand-button']:hover {
    background: color-mix(in srgb, var(--lyra-color-text) 8%, transparent);
  }
  [part='expand-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='group-header'] {
    padding-block: var(--lyra-space-xs);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
    font-weight: var(--lyra-font-weight-semibold);
    text-transform: uppercase;
  }
`;
