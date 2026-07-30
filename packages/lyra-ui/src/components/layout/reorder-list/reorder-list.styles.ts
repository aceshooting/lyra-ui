import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-reorder-list-gap, var(--lr-space-2xs));
    min-inline-size: 0;
    max-inline-size: 100%;
  }
`;
