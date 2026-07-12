import { css } from 'lit';

// Deliberately minimal -- most visual weight comes from whatever the
// registered renderer's own template contributes; this wrapper only needs to
// not collapse to a zero-height inline box while a renderer/skeleton/
// json-viewer child lays itself out.
export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: block;
  }
`;
