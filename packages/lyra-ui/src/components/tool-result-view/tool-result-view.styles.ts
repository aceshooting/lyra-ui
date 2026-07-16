import { css } from 'lit';

// Deliberately minimal -- most visual weight comes from whatever the
// registered renderer's own template contributes; this wrapper only needs to
// not collapse to a zero-height inline box while a renderer/skeleton/
// json-viewer child lays itself out.
export const styles = css`
  :host {
    display: block;
    /* Chains through the shared monospace token (like lyra-json-viewer's
       --lyra-json-viewer-font and lyra-tool-approval-dialog's mono font) so a
       consumer retheming --lyra-theme-font-family-mono also repaints the plain-text
       fallback view, instead of it being stuck on the hardcoded system stack. */
    --lyra-tool-result-view-font: var(--lyra-font-mono);
  }
  [part='base'] {
    display: block;
  }
  [part='fallback-text'] {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--lyra-tool-result-view-font);
    font-size: var(--lyra-font-size-md-sm);
    color: var(--lyra-color-text);
  }
  [part='fallback-copy'] {
    margin-block-start: var(--lyra-space-xs);
  }
`;
