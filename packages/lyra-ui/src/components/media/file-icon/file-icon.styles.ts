import { css } from 'lit';

export const styles = css`
  :host { display: inline-flex; vertical-align: middle; min-inline-size: 0; max-inline-size: 100%; }
  :host([mode='label']) { inline-size: 100%; }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    inline-size: 100%;
    box-sizing: border-box;
  }
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
    flex: 0 0 auto;
  }
  [part='label'],
  [part='description'],
  [part='size'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='label'] { color: var(--lr-color-text); }
  [part='label'] { flex: 1 1 0; }
  [part='description'] { color: var(--lr-color-text-quiet); flex: 1 1 100%; }
  [part='size'] { flex: 0 1 auto; }
`;
