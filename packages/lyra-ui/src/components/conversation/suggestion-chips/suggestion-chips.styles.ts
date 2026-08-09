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
    align-items: center;
    gap: var(--lr-space-xs);
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
  .content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }
  [part='chip-icon'] {
    flex: none;
    line-height: var(--lr-line-height-compact);
  }
  [part~='chip']:hover {
    background: var(--lr-suggestion-chips-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-suggestion-chips-hover-border, var(--lr-color-brand));
  }
  /* Mixes the SAME --lr-suggestion-chips-hover-bg the rule above uses, so a consumer retinting the
     hover fill gets a matching pressed step without a second custom property to keep in sync. */
  [part~='chip']:active {
    background: color-mix(
      in oklab,
      var(--lr-suggestion-chips-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    border-color: var(--lr-suggestion-chips-hover-border, var(--lr-color-brand));
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
