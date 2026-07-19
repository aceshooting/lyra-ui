import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    inline-size: 100%;
  }
  [part='line'] {
    flex: 1 1 auto;
    block-size: var(--lr-border-width-thin);
    background: var(--lr-color-border);
  }
  [part='chip'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(--lr-size-24rem);
    box-sizing: border-box;
    padding: var(--lr-space-2xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
  }
  [part='avatar'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
  }
  [part='avatar'][hidden] {
    display: none;
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
