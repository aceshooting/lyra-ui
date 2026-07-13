import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Contained here (rather than left as a bare font-family literal) so a
       host page can retheme it -- same rationale as lyra-json-viewer's
       identical --lyra-json-viewer-font, no shared --wa-*/--lyra-*
       monospace token exists to resolve through. */
    --lyra-markdown-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    line-height: 1.6;
  }
  [part='content'] {
    overflow-wrap: break-word;
  }
  /* Shared by both the "still loading" and "fell back after a failure"
     states -- see the renderedHtml field doc in markdown.ts. */
  [part='content'][data-fallback] {
    white-space: pre-wrap;
    font-family: inherit;
  }
  [part='content'] > :first-child {
    margin-block-start: 0;
  }
  [part='content'] > :last-child {
    margin-block-end: 0;
  }
  [part='heading'] {
    line-height: 1.25;
    margin-block: var(--lyra-space-l) var(--lyra-space-s);
  }
  [part='content'] p,
  [part='content'] ul,
  [part='content'] ol {
    margin-block: 0 var(--lyra-space-s);
  }
  [part='content'] code {
    font-family: var(--lyra-markdown-font-mono);
    font-size: 0.875em;
    background: var(--lyra-color-brand-quiet);
    border-radius: calc(var(--lyra-radius) * 0.5);
    padding: 0.125rem 0.3125rem;
  }
  [part='code-block'] {
    margin-block: 0 var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand-quiet);
    overflow-x: auto;
  }
  [part='code-block'] code {
    padding: 0;
    background: none;
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  [part='link'] {
    color: var(--lyra-color-brand);
    text-underline-offset: 0.125rem;
  }
  [part='blockquote'] {
    margin-block: 0 var(--lyra-space-s);
    margin-inline: 0;
    padding-inline-start: var(--lyra-space-m);
    border-inline-start: 3px solid var(--lyra-color-border);
    color: var(--lyra-color-text-quiet);
  }
  [part='table'] {
    border-collapse: collapse;
    margin-block: 0 var(--lyra-space-s);
    inline-size: 100%;
  }
  [part='table'] th,
  [part='table'] td {
    border: 1px solid var(--lyra-color-border);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    text-align: start;
  }
  [part='table'] th {
    background: var(--lyra-color-brand-quiet);
    font-weight: 600;
  }
`;
