import { css } from 'lit';

// Deliberately minimal -- most visual weight comes from whatever the
// registered renderer's own template contributes; this wrapper only needs to
// not collapse to a zero-height inline box while a renderer/skeleton/
// json-viewer child lays itself out.
export const styles = css`
  :host {
    display: block;
    /* Chains through the shared monospace token (like lr-json-viewer's
       --lr-json-viewer-font and lr-tool-approval-dialog's mono font) so a
       consumer retheming --lr-theme-font-family-mono also repaints the plain-text
       fallback view, instead of it being stuck on the hardcoded system stack. */
    --lr-tool-result-view-font: var(--lr-font-mono);
  }
  [part='base'] {
    display: block;
  }
  [part='fallback-text'] {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--lr-tool-result-view-font);
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }
  [part='fallback-copy'] {
    margin-block-start: var(--lr-space-xs);
  }
`;
