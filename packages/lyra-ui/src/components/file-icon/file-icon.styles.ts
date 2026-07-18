import { css } from 'lit';

export const styles = css`
  :host { display: inline-flex; vertical-align: middle; }
  [part='base'] { display: inline-flex; align-items: center; gap: var(--lr-space-xs); min-inline-size: 0; }
  [part='icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-file-icon-size, var(--lr-size-2rem));
    block-size: var(--lr-file-icon-size, var(--lr-size-2rem));
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding-inline: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-bold);
    line-height: var(--lr-line-height-none);
    text-transform: uppercase;
  }
  [part='label'] { min-inline-size: 0; color: var(--lr-color-text); }
`;
