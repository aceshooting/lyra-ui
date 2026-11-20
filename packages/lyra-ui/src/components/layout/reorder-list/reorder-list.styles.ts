import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-reorder-list-gap, var(--lr-space-2xs));
    min-inline-size: 0;
    max-inline-size: 100%;
  }
`;
