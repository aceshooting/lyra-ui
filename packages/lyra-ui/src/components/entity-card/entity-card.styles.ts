import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    min-inline-size: 0;
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='title'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-size: var(--lr-font-size-md);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part='description'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='properties'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
`;
