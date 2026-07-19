import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--lr-space-m);
  }
  [part='entity-card'] {
    flex: 1 1 var(--lr-size-16rem);
    min-inline-size: 0;
  }
  [part='confidence'] {
    flex: 0 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part='tabs'] {
    min-inline-size: 0;
  }
`;
