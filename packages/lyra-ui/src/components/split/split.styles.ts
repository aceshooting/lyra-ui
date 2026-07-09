import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='base'] {
    display: flex;
    inline-size: 100%;
    block-size: 100%;
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  [part='divider'] {
    flex: 0 0 auto;
    inline-size: 3px;
    block-size: auto;
    background: var(--lyra-color-border);
    cursor: col-resize;
    touch-action: none;
  }
  :host([orientation='vertical']) [part='divider'] {
    inline-size: auto;
    block-size: 3px;
    cursor: row-resize;
  }
  [part='divider']:hover,
  [part='divider']:focus-visible {
    background: var(--lyra-color-brand);
    outline: none;
  }
`;
