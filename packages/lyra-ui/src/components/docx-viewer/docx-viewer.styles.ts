import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-docx-viewer-max-height: none;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }

  [part='body'] {
    box-sizing: border-box;
    overflow: auto;
    max-block-size: var(--lyra-docx-viewer-max-height);
    padding: var(--lyra-space-l);
  }

  [part='content'] {
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-md-sm);
    line-height: var(--lyra-line-height-normal);
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
    line-height: var(--lyra-line-height-compact);
    margin-block: var(--lyra-space-l) var(--lyra-space-s);
  }

  [part='content'] p,
  [part='content'] ul,
  [part='content'] ol {
    margin-block: 0 var(--lyra-space-s);
  }

  [part='content'] img {
    max-inline-size: 100%;
    block-size: auto;
  }

  [part='content'] table {
    border-collapse: collapse;
    margin-block: 0 var(--lyra-space-s);
    inline-size: 100%;
  }

  [part='content'] th,
  [part='content'] td {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    text-align: start;
  }

  [part='content'] th {
    background: var(--lyra-color-brand-quiet);
    font-weight: var(--lyra-font-weight-semibold);
  }

  .empty-note {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }

  [part='error'] {
    margin: 0;
    padding: var(--lyra-space-l);
    color: var(--lyra-color-danger);
    font-size: var(--lyra-font-size-md-sm);
    text-align: center;
  }

  [part='spinner'] {
    display: flex;
    justify-content: center;
    padding: var(--lyra-space-l);
  }
`;
