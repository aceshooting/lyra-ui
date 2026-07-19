import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='summary'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    padding-block-end: var(--lr-space-s);
  }
  [part='count'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
  }
  [part='count'][data-state='allow'] {
    color: var(--lr-color-success);
  }
  [part='count'][data-state='deny'] {
    color: var(--lr-color-danger);
  }
  [part='count'][data-state='needs-review'] {
    color: var(--lr-color-warning);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
  }
  [part='decision'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding-block: var(--lr-space-s);
  }
  [part='decision']:first-child {
    border-block-start: none;
    padding-block-start: 0;
  }
  [part='decision-header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: var(--lr-space-xs);
    row-gap: var(--lr-space-2xs);
  }
  [part='category'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-6ch);
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }
  [part='state-badge'] {
    flex: 0 0 auto;
  }
  [part='explanation'] {
    font-size: var(--lr-font-size-sm);
  }
  [part='detail'] {
    font-size: var(--lr-font-size-sm);
  }
`;
