import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='select-all'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='select-all'] [role='checkbox'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    padding: var(--lr-size-2px) var(--lr-space-xs);
    cursor: pointer;
  }
  [part='select-all'] [role='checkbox'][aria-checked='true'],
  [part='select-all'] [role='checkbox'][aria-checked='mixed'] {
    background: var(--lr-source-picker-checked-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-source-picker-checked-border, var(--lr-color-brand));
  }
  [part='summary'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part='item'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding: var(--lr-size-4px) var(--lr-space-xs);
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part='item']:hover {
    background: color-mix(in srgb, var(--lr-color-text) 6%, transparent);
  }
  [part='item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='checkbox'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }
  [part='checkbox'][data-state='true'] {
    background: var(--lr-source-picker-checked-bg, var(--lr-color-brand));
    border-color: var(--lr-source-picker-checked-border, var(--lr-color-brand));
  }
  [part='checkbox'][data-state='mixed'] {
    background: var(--lr-source-picker-mixed-bg, color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface)));
    border-color: var(--lr-source-picker-checked-border, var(--lr-color-brand));
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='empty'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
`;
