import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Dark/foreground modules. Canvas can't consume var() directly, so
       qr-code.class.ts resolves this via getComputedStyle at draw time --
       same resolve-via-getComputedStyle pattern as lyra-heatmap's ramp
       endpoints. NOTE: --lyra-color-text flips under a dark theme (like
       every semantic token in tokens.styles.ts), so the *default* rendering
       under a dark theme is a polarity-inverted QR code (light modules on a
       dark background), not the conventional dark-on-light -- see the class
       doc comment. Human legibility is unaffected, but a consumer needing
       guaranteed cross-scanner compatibility regardless of page theme
       should pin --lyra-qr-code-fill/-background explicitly. */
    --lyra-qr-code-fill: var(--lyra-color-text);
    /* Light/background modules, including the quiet zone -- same pattern. */
    --lyra-qr-code-background: var(--lyra-color-surface);
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
    padding-inline: var(--lyra-space-s);
    font-size: var(--lyra-font-size-sm);
    text-align: start;
  }
  [part='empty'],
  [part='loading'] {
    color: var(--lyra-color-text-quiet);
  }
  [part='error'] {
    color: var(--lyra-color-danger);
  }
`;
