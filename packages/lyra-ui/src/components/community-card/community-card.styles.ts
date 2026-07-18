import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
  }
  [part='header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
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
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-md);
    font-weight: var(--lyra-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  :host([compact]) [part='title'] button {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='member-count'] {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
  }
  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='summary'] {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='members'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
  }
  [part='member'],
  [part='overflow'] {
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }
`;
