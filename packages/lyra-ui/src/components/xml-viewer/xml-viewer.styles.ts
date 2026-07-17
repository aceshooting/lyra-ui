import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    max-block-size: var(--lyra-xml-viewer-max-height, none);
    overflow: auto;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-sm);
  }
  [part='toolbar'] {
    display: flex;
    justify-content: flex-end;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
  }
  [part='tree'] {
    padding: var(--lyra-space-xs);
  }
  .row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--lyra-space-2xs);
    padding-block: var(--lyra-size-0-125rem);
    min-inline-size: 0;
    border-radius: var(--lyra-radius);
  }
  [part='node'][data-match] {
    outline: var(--lyra-border-width-thin) dashed var(--lyra-color-warning);
  }
  [part='node'][data-active-match] {
    outline: var(--lyra-border-width-medium) solid var(--lyra-color-warning);
  }
  [part='tag'] {
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='attribute-name'] {
    color: var(--lyra-color-chart-1);
  }
  [part='attribute-value'] {
    color: var(--lyra-color-success);
    overflow-wrap: anywhere;
  }
  [part='tag'][data-match],
  [part='attribute-value'][data-match] {
    background: var(--lyra-color-warning-quiet);
    border-radius: var(--lyra-size-0-1875rem);
  }
  [part='text'] {
    color: var(--lyra-color-text);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  [part='text'][data-match] {
    background: color-mix(in srgb, var(--lyra-color-warning) 30%, transparent);
    border-radius: var(--lyra-size-0-1875rem);
  }
  [part='comment'],
  [part='cdata'],
  [part='pi'] {
    color: var(--lyra-color-text-quiet);
    font-style: italic;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .preview {
    color: var(--lyra-color-text-quiet);
    font-style: italic;
    margin-inline: var(--lyra-space-xs);
  }
  [part='toggle'] {
    inline-size: var(--lyra-icon-button-size);
    block-size: var(--lyra-icon-button-size);
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: 0;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='toggle'][hidden] {
    visibility: hidden;
  }
  [part='toggle'] .chevron {
    display: inline-flex;
    transform: rotate(0deg);
    transition: transform var(--lyra-transition-fast);
  }
  [part='toggle'][aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }
  :host(:dir(rtl)) [part='toggle'][aria-expanded='false'] .chevron {
    transform: rotate(180deg);
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
  [part='copy-button'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    padding: var(--lyra-size-0-125rem) var(--lyra-space-xs);
  }
  [part='copy-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
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
    color: var(--lyra-color-danger);
    padding: var(--lyra-space-l);
    text-align: center;
  }
  [part='spinner'] {
    padding: var(--lyra-space-l);
    text-align: center;
    color: var(--lyra-color-text-quiet);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] .chevron {
      transition: none !important;
    }
  }
`;
