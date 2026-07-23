import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap -- 'none' means the viewer grows with its
       content, matching every other block-level component in this library
       until a caller opts into an internal scrollbar via the max-height
       attribute. */
    --lr-json-viewer-max-height: none;
    /* Contained here (rather than left as a bare font-family literal) so a
       host page can retheme it, same rationale as --lr-widget-overlay-color
       in widget.styles.ts -- no shared --lr-* monospace token exists
       to resolve through. */
    --lr-json-viewer-font: var(--lr-font-mono);
    --lr-json-viewer-active-outline: var(--lr-focus-ring-color);
    --lr-json-viewer-string-color: var(--lr-color-success);
    --lr-json-viewer-number-color: var(--lr-color-brand);
    --lr-json-viewer-boolean-color: var(--lr-color-warning);
    --lr-json-viewer-null-color: var(--lr-color-text-quiet);
    font-family: var(--lr-json-viewer-font);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-loose);
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lr-json-viewer-max-height);
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='toolbar'] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
    display: flex;
    justify-content: flex-end;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='tree'] {
    padding: var(--lr-space-s);
    /* A JSON tree's structure -- key, colon, value, brackets, indentation -- reads
       left-to-right regardless of the surrounding document direction, exactly like
       code and like every JSON view (devtools, VS Code). Without this, an ancestor
       dir="rtl" reverses each row to value-colon-key order, right-aligns the tree, and
       flips the disclosure chevrons, so the data reads backwards. A key/value that
       itself contains RTL text still renders that run correctly via the bidi algorithm;
       only the LTR scaffolding is pinned. Matches code-block's [part='pre'] lock. */
    direction: ltr;
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    border-radius: var(--lr-radius);
  }
  .row:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover/
     :focus-within themselves -- (0,1,0) total, so a consumer's own ::part(copy-button):hover
     override ((0,1,1)) wins without needing !important -- same fix shape as
     lr-attachment-trigger's/lr-copy-button's own :where()-wrapped hover rule. */
  :where(.row):hover :where([part='copy-button']),
  :where(.row):focus-within :where([part='copy-button']) {
    opacity: 1;
  }
  [part='toggle'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size, even for deeply nested rows. */
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-block-start: var(--lr-size-0-1875rem);
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  /* The UA '[hidden] { display: none }' rule is author-overridable by any
     same-origin declaration for that element regardless of specificity --
     author rules always win over user-agent rules unless !important is
     involved -- so this only needs to add visibility, not re-declare
     display. Keeping the box (rather than display:none) preserves this
     leaf/empty row's alignment with sibling rows that do have a chevron. */
  [part='toggle'][hidden] {
    visibility: hidden;
  }
  [part='toggle'] .chevron {
    display: inline-flex;
    transform: rotate(0deg);
    transition: transform var(--lr-transition-fast);
  }
  [part='toggle'][aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }
  /* No RTL chevron override: [part='tree'] above is pinned direction:ltr, so a collapsed
     row's disclosure chevron always points at the LTR-positioned children (to the right),
     the same as it does in an LTR document. */
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself
     -- (0,1,0) total, so a consumer's own ::part(toggle):hover override ((0,1,1)) wins without
     needing !important -- same fix shape as lr-attachment-trigger's/lr-copy-button's own
     :where()-wrapped hover rule. */
  :where([part='toggle']):hover:where(:not([hidden])) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Stands in for [part='toggle'] on the closing-bracket row, so it must match the toggle's
     actual used inline-size -- min-inline-size wins over the toggle's own smaller inline-size,
     so the real box is --lr-icon-button-size, not --lr-size-1-25rem. */
  .toggle-space {
    inline-size: var(--lr-icon-button-size);
    flex: 0 0 auto;
  }
  [part='key'] {
    flex: 0 0 auto;
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  .colon {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    margin-inline-end: var(--lr-space-xs);
  }
  [part='bracket'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  /* --lr-json-viewer-match-bg indirection (rather than the bare --lr-color-warning-quiet token)
     lets a consumer retheme just this component's search-match highlight without repainting
     every other warning-toned surface on the page that reads the same shared token. */
  [part='key'][data-match],
  [part='value'][data-match] {
    background: var(--lr-json-viewer-match-bg, var(--lr-color-warning-quiet));
    border-radius: var(--lr-size-0-1875rem);
    box-shadow: 0 0 0 var(--lr-size-0-125rem) var(--lr-json-viewer-match-bg, var(--lr-color-warning-quiet));
  }
  [part='value'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: pre-wrap;
  }
  [part='value'][data-type='string'] {
    color: var(--lr-json-viewer-string-color);
  }
  [part='value'][data-type='number'] {
    color: var(--lr-json-viewer-number-color);
  }
  [part='value'][data-type='boolean'] {
    color: var(--lr-json-viewer-boolean-color);
  }
  [part='value'][data-type='null'],
  [part='value'][data-type='undefined'],
  [part='value'][data-type='circular'] {
    color: var(--lr-json-viewer-null-color);
    font-style: italic;
  }
  [part='key'][data-active],
  [part='value'][data-active] {
    outline: var(--lr-focus-ring-width) solid var(--lr-json-viewer-active-outline);
    outline-offset: var(--lr-focus-ring-offset);
  }
  .preview {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-style: italic;
    margin-inline: var(--lr-space-xs);
  }
  [part='copy-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    border: none;
    background: none;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-none);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Per-node copy buttons stay out of the way until the row is actually
     being interacted with -- the toolbar's own top-level copy button is
     exempt (it has no ancestor .row, so this rule never matches it). */
  .row [part='copy-button'] {
    opacity: 0;
  }
  .row [part='copy-button']:focus-visible {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] .chevron {
      transition: none !important;
    }
  }
`;
