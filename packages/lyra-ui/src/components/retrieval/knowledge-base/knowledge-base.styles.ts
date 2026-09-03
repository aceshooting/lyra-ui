import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }
  [part='heading'] {
    margin: 0;
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='create-button'] {
    flex: 0 0 auto;
  }
  [part='summary'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }
  [part='summary-stat'] {
    flex: 1 1 var(--lr-size-8rem);
    min-inline-size: 0;
  }
  [part='table'] {
    inline-size: 100%;
    font: inherit;
  }
  [part='table']::part(name-cell),
  [part='table']::part(sync-cell),
  [part='table']::part(health-cell) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  [part='table']::part(source-name) {
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text);
  }
  [part='table']::part(source-type),
  [part='table']::part(sync-timestamp),
  [part='table']::part(document-count) {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='table']::part(sync-error) {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='table']::part(sync-badge),
  [part='table']::part(health-badge) {
    align-self: flex-start;
  }
  [part='table']::part(actions-menu) {
    display: flex;
    justify-content: flex-end;
    font: inherit;
  }
  [part='table']::part(actions-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: none;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    font: inherit;
  }
  [part='table']::part(actions-trigger):hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
    color: var(--lr-color-text);
  }
  [part='table']::part(actions-trigger):active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
    color: var(--lr-color-text);
  }
  [part='table']::part(actions-trigger):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
