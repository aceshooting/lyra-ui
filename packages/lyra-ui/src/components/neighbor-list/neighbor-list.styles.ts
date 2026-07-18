import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='row'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='node-label'] {
    flex: 1 1 auto;
    display: flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding: var(--lr-size-2px) 0;
    border: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='node-label']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='direction'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  [part='relation'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part='node-meta'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
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
       same split as lr-code-block's own [part='toggle']. */
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part='expand-button']:hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  [part='expand-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='group-header'] {
    padding-block: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
  }
`;
