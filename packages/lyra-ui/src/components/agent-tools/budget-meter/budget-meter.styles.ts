import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='base'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
  }

  [part='label'] {
    margin-block: 0 var(--lr-space-s);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='meter'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='track'] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: var(--lr-size-0-75rem);
    overflow: hidden;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface-raised);
  }

  [part='fill'] {
    display: block;
    max-inline-size: 100%;
    block-size: 100%;
    border-radius: inherit;
    background: var(--lr-color-brand);
  }

  [part='percent'],
  [part='value'],
  [part='unavailable'],
  [part='exceeded'] {
    display: block;
    max-inline-size: 100%;
    margin-block: var(--lr-space-xs) 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='exceeded'] {
    color: var(--lr-color-danger);
  }
`;
