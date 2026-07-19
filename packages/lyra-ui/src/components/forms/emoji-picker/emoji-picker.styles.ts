import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    --lr-emoji-picker-item-size: var(--lr-icon-button-size);
    --lr-emoji-picker-gap: var(--lr-space-2xs);
    --lr-emoji-picker-row-height: calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l));
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
  [part='grid'] {
    scrollbar-gutter: stable;
  }
  /* Off-flow geometry probes (not parts -- never exposed to consumers). A custom property's
     computed value is an unresolved token stream ('2.5rem', 'calc(2.5rem + 1rem)'), never a pixel
     length, so the windowed layout resolves each geometry token by assigning it to one of these
     boxes and reading that box's used inline size back. Absolutely positioned and hidden, so they
     take part in layout (a box is what makes a used size exist) without painting or affecting the
     grid. */
  [data-probe='root'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    visibility: hidden;
    pointer-events: none;
  }
  [data-probe='item'],
  [data-probe='gap'],
  [data-probe='row'] {
    block-size: 0;
  }
  [data-probe='item'] {
    /* Mirrors [part='emoji']'s inline box, shared minimum included, so the resolved item size is
       the size actually painted. */
    inline-size: var(--lr-emoji-picker-item-size);
    min-inline-size: var(--lr-icon-button-size);
  }
  [data-probe='gap'] {
    inline-size: var(--lr-emoji-picker-gap);
  }
  [data-probe='row'] {
    inline-size: var(--lr-emoji-picker-row-height);
  }
  [part='virtual-spacer'] {
    position: relative;
    min-block-size: 100%;
  }
  [part='virtual-row'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 0;
    min-block-size: var(--lr-emoji-picker-row-height);
  }
  [part='virtual-items'] {
    display: flex;
    gap: var(--lr-emoji-picker-gap);
    min-block-size: var(--lr-emoji-picker-item-size);
  }
  [part='virtual-label'] {
    block-size: var(--lr-space-l);
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
    inline-size: var(--lr-emoji-picker-item-size);
    block-size: var(--lr-emoji-picker-item-size);
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
