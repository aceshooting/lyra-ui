import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    align-items: stretch;
    gap: var(--lyra-size-1px);
    block-size: var(--lyra-sequence-strip-height, var(--lyra-size-1-5rem));
    border-radius: var(--lyra-radius-xs);
    overflow: hidden;
  }
  [part='cell'] {
    position: relative;
    flex: 1 1 0;
    min-inline-size: var(--lyra-size-2px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  [part='marker'] {
    display: block;
    inline-size: 100%;
    block-size: var(--lyra-size-2px);
    background: var(--lyra-sequence-strip-marker-color, var(--lyra-color-text));
  }
`;
