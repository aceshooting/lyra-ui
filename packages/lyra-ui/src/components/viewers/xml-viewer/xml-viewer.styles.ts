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
  [part='node'][data-match] {
    outline: var(--lr-border-width-thin) dashed var(--lr-color-warning);
  }
  [part='node'][data-active-match] {
    outline: var(--lr-border-width-medium) solid var(--lr-color-warning);
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
  [part='tag'][data-match],
  [part='attribute-value'][data-match] {
    background: var(--lr-color-warning-quiet);
    border-radius: var(--lr-size-0-1875rem);
  }
  [part='text'] {
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  [part='text'][data-match] {
    background: color-mix(in srgb, var(--lr-color-warning) 30%, transparent);
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
  [part='toggle'] {
    /* Keep the glyph compact while giving the interactive box the shared minimum target size.
       --lr-icon-button-size is a floor, not a fixed size, so lowering it never squashes the
       chevron below its own box. */
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
    cursor: pointer;
  }
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
  :host(:dir(rtl)) [part='toggle'][aria-expanded='false'] .chevron {
    transform: rotate(180deg);
  }
  [part='toggle']:not([hidden]):hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
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
  .row [part='copy-button'] {
    margin-inline-start: auto;
    opacity: 0;
  }
  .row:hover [part='copy-button'],
  .row:focus-within [part='copy-button'] {
    opacity: 1;
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
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
