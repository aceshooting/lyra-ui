import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    min-inline-size: 0;
  }
  [part='select-all'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding-block: var(--lyra-space-xs);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='select-all'] [role='checkbox'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    padding: var(--lyra-size-2px) var(--lyra-space-xs);
    cursor: pointer;
  }
  [part='select-all'] [role='checkbox'][aria-checked='true'],
  [part='select-all'] [role='checkbox'][aria-checked='mixed'] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
  }
  [part='summary'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }
  [part='item'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
    padding: var(--lyra-size-4px) var(--lyra-space-xs);
    border-radius: var(--lyra-radius-xs);
    cursor: pointer;
  }
  [part='item']:hover {
    background: color-mix(in srgb, var(--lyra-color-text) 6%, transparent);
  }
  [part='item']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-width));
  }
  [part='checkbox'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-1rem);
    block-size: var(--lyra-size-1rem);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    background: var(--lyra-color-surface);
  }
  [part='checkbox'][data-state='true'] {
    background: var(--lyra-color-brand);
    border-color: var(--lyra-color-brand);
  }
  [part='checkbox'][data-state='mixed'] {
    background: color-mix(in srgb, var(--lyra-color-brand) 50%, var(--lyra-color-surface));
    border-color: var(--lyra-color-brand);
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='empty'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
`;
