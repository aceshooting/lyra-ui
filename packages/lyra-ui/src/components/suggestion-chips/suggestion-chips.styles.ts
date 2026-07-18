import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    max-inline-size: 100%;
  }
  [part='base'] {
    max-inline-size: 100%;
  }
  .row {
    display: flex;
    gap: var(--lr-space-xs);
  }
  :host([wrap]) .row {
    flex-wrap: wrap;
  }
  [part~='chip'] {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--lr-space-2xs);
    flex: 0 0 auto;
    max-inline-size: var(--lr-size-16rem);
    padding-inline: var(--lr-space-m);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
    min-block-size: var(--lr-size-2-5rem);
  }
  [part~='chip']:hover {
    background: var(--lr-color-brand-quiet);
    border-color: var(--lr-color-brand);
  }
  [part~='chip']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='chip-label'] {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    inline-size: 100%;
  }
  [part='chip-detail'] {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
`;
