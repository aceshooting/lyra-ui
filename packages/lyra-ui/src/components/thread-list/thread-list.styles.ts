import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-block-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='search'] {
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='search-input'] {
    box-sizing: border-box;
    inline-size: 100%;
    padding-inline: var(--lyra-space-s);
    padding-block: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='search-input']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='list'] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
  }
  lyra-virtual-list {
    flex: 1 1 auto;
    min-block-size: 0;
    display: block;
  }
  [part='empty'] {
    padding: var(--lyra-space-l);
    color: var(--lyra-color-text-quiet);
    text-align: center;
  }
  [part~='row-action'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size. */
    inline-size: var(--lyra-size-1-5rem);
    block-size: var(--lyra-size-1-5rem);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lyra-radius-xs);
    background: transparent;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
  }
  [part~='row-action']:hover {
    background: var(--lyra-color-surface-raised);
    color: var(--lyra-color-text);
  }
  [part~='row-action']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='pin-glyph'] {
    display: inline-flex;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-2xs);
  }
`;
