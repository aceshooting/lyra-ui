import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Canvas paint resolves these computed host styles live. The optional
       aliases deliberately have no token defaults: inherited color and a
       transparent host background are the mirrored renderer defaults. */
    color: var(--lr-qr-code-fill, inherit);
    background-color: var(--lr-qr-code-background, initial);
  }
  [part~='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  canvas {
    display: block;
  }
  canvas[hidden] {
    display: none;
  }
  [part='empty'],
  [part='loading'],
  [part='error'] {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    block-size: 100%;
    padding-inline: var(--lr-space-s);
    font-size: var(--lr-font-size-sm);
    text-align: start;
  }
  [part='empty'],
  [part='loading'] {
    color: var(--lr-color-text-quiet);
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
`;
