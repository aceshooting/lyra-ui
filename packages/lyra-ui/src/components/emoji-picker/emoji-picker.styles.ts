import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-s);
    background: var(--lr-color-surface);
  }
  [part='search'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='search']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='grid'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
    max-block-size: var(--lr-size-16rem);
    overflow-y: auto;
  }
  [part='group-label'] {
    flex-basis: 100%;
    padding-block: var(--lr-space-2xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='emoji'] {
    /* Keep the glyph compact (font-size is unaffected by the box growing) while giving the
       interactive box the shared minimum target size -- same "small glyph, padded hit box"
       pattern as lr-code-block's/lr-json-viewer's [part='toggle']. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-2rem);
    block-size: var(--lr-size-2rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    font-size: var(--lr-font-size-lg);
    cursor: pointer;
  }
  [part='emoji']:hover,
  [part='emoji'][data-active] {
    background: var(--lr-color-brand-quiet);
  }
  [part='empty'] {
    flex-basis: 100%;
    padding: var(--lr-space-m);
    text-align: center;
    color: var(--lr-color-text-quiet);
  }
`;
