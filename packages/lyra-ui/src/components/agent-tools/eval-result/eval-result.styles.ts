import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    min-inline-size: 0;
    color: var(--lr-color-text);
  }

  [part='empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='grid'],
  [part='review'],
  [part='diff'],
  [part='diff-view'] {
    min-inline-size: 0;
  }

  [part='diff'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='diff-labels'] {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-02em);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='diff-label-old'],
  [part='diff-label-new'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
`;
