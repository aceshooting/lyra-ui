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
  [part='fallback-text'] {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--lyra-tool-result-view-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
    font-size: var(--lyra-font-size-md-sm);
    color: var(--lyra-color-text);
  }
  [part='fallback-copy'] {
    margin-block-start: var(--lyra-space-xs);
  }
`;
