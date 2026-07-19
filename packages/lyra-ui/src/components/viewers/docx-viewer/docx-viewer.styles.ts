import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-docx-viewer-max-height: none;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }

  [part='body'] {
    box-sizing: border-box;
    overflow: auto;
    max-block-size: var(--lr-docx-viewer-max-height);
    padding: var(--lr-space-l);
  }

  [part='content'] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
    overflow-wrap: break-word;
  }

  [part='content'] > :first-child {
    margin-block-start: 0;
  }

  [part='content'] > :last-child {
    margin-block-end: 0;
  }

  [part='content'] h1,
  [part='content'] h2,
  [part='content'] h3,
  [part='content'] h4,
  [part='content'] h5,
  [part='content'] h6 {
    line-height: var(--lr-line-height-compact);
    margin-block: var(--lr-space-l) var(--lr-space-s);
  }

  [part='content'] p,
  [part='content'] ul,
  [part='content'] ol {
    margin-block: 0 var(--lr-space-s);
  }

  [part='content'] img {
    max-inline-size: 100%;
    block-size: auto;
  }

  [part='content'] table {
    border-collapse: collapse;
    margin-block: 0 var(--lr-space-s);
    inline-size: 100%;
  }

  [part='content'] th,
  [part='content'] td {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding: var(--lr-space-xs) var(--lr-space-s);
    text-align: start;
  }

  [part='content'] th {
    background: var(--lr-color-brand-quiet);
    font-weight: var(--lr-font-weight-semibold);
  }

  .empty-note {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }

  [part='spinner'] {
    display: flex;
    justify-content: center;
    padding: var(--lr-space-l);
  }

  /* Painted text-quote highlights: the CSS Custom Highlight API path styles the browser-native
     ::highlight() pseudo (no element exists to select, so a [part='content'] mark[...] selector
     below never matches on that path); the <mark>-wrap fallback path styles the real elements
     text-highlights.ts creates in this same shadow tree. Both are kept in sync by tone. */
  ::highlight(lr-highlight-accent) {
    background-color: var(--lr-color-brand-quiet);
  }
  ::highlight(lr-highlight-success) {
    background-color: var(--lr-color-success-quiet);
  }
  ::highlight(lr-highlight-warning) {
    background-color: var(--lr-color-warning-quiet);
  }
  ::highlight(lr-highlight-danger) {
    background-color: var(--lr-color-danger-quiet);
  }
  ::highlight(lr-highlight-neutral) {
    background-color: var(--lr-color-surface);
  }
  ::highlight(lr-highlight-active) {
    background-color: var(--lr-color-brand-quiet);
    text-decoration: underline;
  }
  [part='content'] mark[data-lr-highlight-tone] {
    background: var(--lr-color-brand-quiet);
    color: inherit;
    border-radius: calc(var(--lr-radius) * 0.5);
    cursor: pointer;
  }
  [part='content'] mark[data-lr-highlight-tone='success'] {
    background: var(--lr-color-success-quiet);
  }
  [part='content'] mark[data-lr-highlight-tone='warning'] {
    background: var(--lr-color-warning-quiet);
  }
  [part='content'] mark[data-lr-highlight-tone='danger'] {
    background: var(--lr-color-danger-quiet);
  }
  [part='content'] mark[data-lr-highlight-tone='neutral'] {
    background: var(--lr-color-surface);
  }
  [part='content'] mark[data-lr-highlight-name='lr-highlight-active'] {
    outline: var(--lr-border-width-thin) solid var(--lr-color-brand);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='content'] mark[part~='search-match'] {
    background: var(--lr-color-warning-quiet);
    color: inherit;
    border-radius: var(--lr-radius-xs);
  }
  [part='content'] mark[part~='search-match-active'] {
    background: var(--lr-color-warning);
    color: var(--lr-color-on-warning);
  }
`;
