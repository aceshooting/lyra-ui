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
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='search-input'] {
    box-sizing: border-box;
    inline-size: 100%;
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='search-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='list'] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
  }
  lr-virtual-list {
    flex: 1 1 auto;
    min-block-size: 0;
    display: block;
  }
  [part='empty'] {
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
  lr-virtual-list::part(group-header) {
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
  }
  lr-virtual-list::part(group-toggle) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  lr-virtual-list::part(group-toggle):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(group-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1rem);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-normal);
  }
  lr-virtual-list::part(row-leading),
  lr-virtual-list::part(row-content),
  lr-virtual-list::part(row-meta),
  lr-virtual-list::part(row-actions) {
    min-inline-size: 0;
  }
  lr-virtual-list::part(row-action) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size. */
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  lr-virtual-list::part(row-action):hover {
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }
  lr-virtual-list::part(row-action):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(pin-glyph) {
    display: inline-flex;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-2xs);
  }
`;
