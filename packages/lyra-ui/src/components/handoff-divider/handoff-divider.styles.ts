import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    inline-size: 100%;
  }
  [part='line'] {
    flex: 1 1 auto;
    block-size: var(--lyra-border-width-thin);
    background: var(--lyra-color-border);
  }
  [part='chip'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(--lyra-size-24rem);
    box-sizing: border-box;
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface-raised);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
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
