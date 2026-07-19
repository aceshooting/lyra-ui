import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
    font-size: var(--lr-font-size-sm);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='title'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
  }
`;
