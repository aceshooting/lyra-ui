import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
    font-size: var(--lyra-font-size-sm);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='header'][hidden] {
    display: none;
  }
  [part='title'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    color: var(--lyra-color-text);
    font-weight: var(--lyra-font-weight-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='actions'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 0 0 auto;
  }
  [part='actions'][hidden] {
    display: none;
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-s);
  }
`;
