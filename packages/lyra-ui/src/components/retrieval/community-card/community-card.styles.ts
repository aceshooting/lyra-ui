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
  }
  /* Strips the card chrome for a community card nested inside an already-bordered/backgrounded
     container -- same escape hatch as this component's own sibling lr-entity-card's identical
     appearance='plain' rule. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
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
  }
  [part='title'] button {
    display: block;
    max-inline-size: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-md);
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  [part='title'] button:hover {
    text-decoration: underline;
  }
  [part='title'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([compact]) [part='title'] button {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='member-count'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='summary'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='members'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }
  [part='member'],
  [part='overflow'] {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }
  [part='member']:hover,
  [part='overflow']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='member']:focus-visible,
  [part='overflow']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
