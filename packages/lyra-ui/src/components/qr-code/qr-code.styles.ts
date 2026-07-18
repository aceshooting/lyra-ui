import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Dark/foreground modules. Canvas can't consume var() directly, so
       qr-code.class.ts resolves this via getComputedStyle at draw time --
       same resolve-via-getComputedStyle pattern as lr-heatmap's ramp
       endpoints. NOTE: --lr-color-text flips under a dark theme (like
       every semantic token in tokens.styles.ts), so the *default* rendering
       under a dark theme is a polarity-inverted QR code (light modules on a
       dark background), not the conventional dark-on-light -- see the class
       doc comment. Human legibility is unaffected, but a consumer needing
       guaranteed cross-scanner compatibility regardless of page theme
       should pin --lr-qr-code-fill/-background explicitly. */
    --lr-qr-code-fill: var(--lr-color-text);
    /* Light/background modules, including the quiet zone -- same pattern. */
    --lr-qr-code-background: var(--lr-color-surface);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  canvas {
    display: block;
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
