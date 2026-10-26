import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='surface'] { min-inline-size: 0; overflow-wrap: anywhere; }
  [part='node'] { display: contents; }
  [data-gen-type] { min-inline-size: 0; max-inline-size: 100%; }
  :where([data-gen-type='stack'], [data-gen-type='form']) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  :where([data-gen-type='row']) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-m);
  }
  [part='loading'], [part='error'], [part='empty'] {
    padding: var(--lr-space-m);
    margin: 0;
    color: var(--lr-color-text-quiet);
  }
  [part='loading'] { min-block-size: var(--lr-gen-loading-block-size, var(--lr-icon-button-size)); }
`;
