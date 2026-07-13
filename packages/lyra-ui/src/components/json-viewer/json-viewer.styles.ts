import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap -- 'none' means the viewer grows with its
       content, matching every other block-level component in this library
       until a caller opts into an internal scrollbar via the max-height
       attribute. */
    --lyra-json-viewer-max-height: none;
    /* Contained here (rather than left as a bare font-family literal) so a
       host page can retheme it, same rationale as --lyra-widget-overlay-color
       in widget.styles.ts -- no shared --wa-*/--lyra-* monospace token exists
       to resolve through. */
    --lyra-json-viewer-font: var(--lyra-font-mono);
    font-family: var(--lyra-json-viewer-font);
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-loose);
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lyra-json-viewer-max-height);
    overflow: auto;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='toolbar'] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lyra-layer-content);
    display: flex;
    justify-content: flex-end;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
  }
  [part='tree'] {
    padding: var(--lyra-space-s);
  }
  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
    border-radius: var(--lyra-radius);
  }
  .row:hover {
    background: var(--lyra-color-brand-quiet);
  }
  .row:hover [part='copy-button'],
  .row:focus-within [part='copy-button'] {
    opacity: 1;
  }
  [part='toggle'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size, even for deeply nested rows. */
    inline-size: var(--lyra-size-1-25rem);
    block-size: var(--lyra-size-1-25rem);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    margin-block-start: var(--lyra-size-0-1875rem);
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
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
    transition: transform var(--lyra-transition-fast);
  }
  [part='toggle']:not([hidden]):hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  .toggle-space {
    inline-size: var(--lyra-size-1-25rem);
    flex: 0 0 auto;
  }
  [part='key'] {
    flex: 0 0 auto;
    font-weight: var(--lyra-font-weight-semibold);
    color: var(--lyra-color-text);
  }
  .colon {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
    margin-inline-end: var(--lyra-space-xs);
  }
  [part='bracket'] {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
  }
  [part='key'][data-match],
  [part='value'][data-match] {
    background: var(--lyra-color-warning-quiet);
    border-radius: var(--lyra-size-0-1875rem);
    box-shadow: 0 0 0 var(--lyra-size-0-125rem) var(--lyra-color-warning-quiet);
  }
  [part='value'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: pre-wrap;
  }
  [part='value'][data-type='string'] {
    color: var(--lyra-color-success);
  }
  [part='value'][data-type='number'] {
    color: var(--lyra-color-brand);
  }
  [part='value'][data-type='boolean'] {
    color: var(--lyra-color-warning);
  }
  [part='value'][data-type='null'],
  [part='value'][data-type='undefined'],
  [part='value'][data-type='circular'] {
    color: var(--lyra-color-text-quiet);
    font-style: italic;
  }
  .preview {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
    font-style: italic;
    margin-inline: var(--lyra-space-xs);
  }
  [part='copy-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    line-height: var(--lyra-line-height-none);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
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
