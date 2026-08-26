import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    max-block-size: var(--lr-xml-viewer-max-height, none);
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
  }
  [part='toolbar'] {
    display: flex;
    justify-content: flex-end;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='tree'] {
    padding: var(--lr-space-xs);
  }
  .row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
    padding-block: var(--lr-size-0-125rem);
    min-inline-size: 0;
    border-radius: var(--lr-radius);
  }
  /* --lr-xml-viewer-match-color, not the bare --lr-color-warning, so a consumer retints this
     non-active search match without touching every warning-toned surface on the page reading that
     shared token -- as --lr-xml-viewer-active-match-color does below for the active match. */
  [part='node'][data-match] {
    outline: var(--lr-border-width-thin) dashed var(--lr-xml-viewer-match-color, var(--lr-color-warning));
  }
  [part='node'][data-active-match] {
    outline: var(--lr-border-width-medium) solid var(--lr-xml-viewer-active-match-color, var(--lr-color-warning));
  }
  /* Host-supplied highlights. Each tone resolves into one private carrier so the row tint and the
     action button read from a single base -- the lr-archive-viewer/lr-docx-viewer shape, on the
     same quiet fill tokens, built to sit behind body text at an accessible contrast ratio. Neutral
     takes --lr-color-surface-raised, not --lr-color-surface: tinting a row with the viewer's own
     background would render it unhighlighted. */
  [part='node'][data-highlight] {
    --_lr-xml-viewer-highlight-background: var(--lr-xml-viewer-highlight-accent-background, var(--lr-color-brand-quiet));
    background: var(--_lr-xml-viewer-highlight-background);
  }
  [part='node'][data-highlight='success'] {
    --_lr-xml-viewer-highlight-background: var(--lr-xml-viewer-highlight-success-background, var(--lr-color-success-quiet));
  }
  [part='node'][data-highlight='warning'] {
    --_lr-xml-viewer-highlight-background: var(--lr-xml-viewer-highlight-warning-background, var(--lr-color-warning-quiet));
  }
  [part='node'][data-highlight='danger'] {
    --_lr-xml-viewer-highlight-background: var(--lr-xml-viewer-highlight-danger-background, var(--lr-color-danger-quiet));
  }
  [part='node'][data-highlight='neutral'] {
    --_lr-xml-viewer-highlight-background: var(--lr-xml-viewer-highlight-neutral-background, var(--lr-color-surface-raised));
  }
  [part='node'][data-active-highlight] {
    outline: var(--lr-border-width-medium) solid var(--lr-xml-viewer-highlight-active-outline, var(--lr-color-brand));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='highlight-action'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-inline-start: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
  }
  [part='highlight-action']:hover {
    background: var(--_lr-xml-viewer-highlight-background);
  }
  [part='highlight-action']:active {
    background: color-mix(in oklab, var(--_lr-xml-viewer-highlight-background), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='highlight-action']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The one attribute an attribute-addressing node-path anchor resolved to, so a citation pointing
     at a single attribute value of a multi-attribute element stays identifiable. */
  [part='attribute'][data-active] {
    outline: var(--lr-border-width-medium) solid var(--lr-xml-viewer-active-attribute-color, var(--lr-color-brand));
    border-radius: var(--lr-size-0-1875rem);
  }
  [part='tag'] {
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='attribute-name'] {
    color: var(--lr-color-chart-1);
  }
  [part='attribute-value'] {
    color: var(--lr-color-success);
    overflow-wrap: anywhere;
  }
  /* --lr-xml-viewer-match-bg indirection, same rationale as --lr-xml-viewer-match-color above. */
  [part='tag'][data-match],
  [part='attribute-value'][data-match] {
    background: var(--lr-xml-viewer-match-bg, var(--lr-color-warning-quiet));
    border-radius: var(--lr-size-0-1875rem);
  }
  [part='text'] {
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  [part='text'][data-match] {
    background: color-mix(in srgb, var(--lr-xml-viewer-match-color, var(--lr-color-warning)) 30%, transparent);
    border-radius: var(--lr-size-0-1875rem);
  }
  [part='comment'],
  [part='cdata'],
  [part='pi'] {
    color: var(--lr-color-text-quiet);
    font-style: italic;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .preview {
    color: var(--lr-color-text-quiet);
    font-style: italic;
    margin-inline: var(--lr-space-xs);
  }
  [part='toggle'],
  [part='toggle-placeholder'] {
    /* Keep the glyph compact while the interactive box takes the shared minimum target size.
       --lr-icon-button-size is a floor, not a fixed size, so lowering it never squashes the
       chevron. */
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: 0;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
  }
  [part='toggle'] { cursor: pointer; }
  [part='toggle'] .chevron {
    display: inline-flex;
    transform: rotate(0deg);
    transition: transform var(--lr-transition-fast);
  }
  [part='toggle'][aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }
  :host(:dir(rtl)) [part='toggle'][aria-expanded='false'] .chevron {
    transform: rotate(180deg);
  }
  [part='toggle']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='toggle']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    color: var(--lr-color-brand);
  }
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='copy-button'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
  }
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Also the pressed state the row-reveal rule below needs: that rule only fades the button in, so
     the acknowledgement of the click itself lives here. */
  [part='copy-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    color: var(--lr-color-brand);
  }
  .row [part='copy-button'] {
    margin-inline-start: auto;
    opacity: 0;
  }
  /* Full specificity on both compounds, deliberately: this rule exists only to beat the (0,2,0)
     '.row [part=copy-button] { opacity: 0 }' resting rule above. :where() on either compound drops
     it to (0,1,0), so the resting rule wins from any source position and the button never fades
     in. */
  .row:hover [part='copy-button'],
  .row:focus-within [part='copy-button'] {
    opacity: 1;
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }
  .empty-note {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
  [part='spinner'] {
    padding: var(--lr-space-l);
    text-align: center;
    color: var(--lr-color-text-quiet);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] .chevron {
      transition: none !important;
    }
  }
`;
