import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Contained here (rather than left as a bare font-family literal) so a
       host page can retheme it -- same rationale as lyra-json-viewer's
       identical --lyra-json-viewer-font, no shared --wa-*/--lyra-*
       monospace token exists to resolve through. */
    --lyra-markdown-font-mono: var(--lyra-font-mono);
    line-height: var(--lyra-line-height-loose);
  }
  [part='content'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-inline: auto;
    overflow-wrap: anywhere;
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
    line-height: var(--lyra-line-height-compact);
    margin-block: var(--lyra-space-l) var(--lyra-space-s);
  }
  [part='content'] p,
  [part='content'] ul,
  [part='content'] ol {
    margin-block: 0 var(--lyra-space-s);
  }
  [part='content'] code {
    font-family: var(--lyra-markdown-font-mono);
    font-size: var(--lyra-size-0-875em);
    background: var(--lyra-color-brand-quiet);
    border-radius: calc(var(--lyra-radius) * 0.5);
    padding: var(--lyra-size-0-125rem) var(--lyra-size-0-3125rem);
  }
  [part='code-block'] {
    margin-block: 0 var(--lyra-space-s);
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-brand-quiet);
    overflow-inline: auto;
  }
  [part='code-block'] code {
    padding: 0;
    background: none;
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-normal);
  }
  [part='link'] {
    color: var(--lyra-color-brand);
    text-underline-offset: var(--lyra-size-0-125rem);
  }
  /* Keeps an oversized source image from overflowing the content wrapper --
     matches the overflow-wrap: anywhere guard on [part='content'] above,
     which only covers text, not replaced elements like <img>. */
  [part='img'] {
    max-inline-size: 100%;
  }
  [part='blockquote'] {
    margin-block: 0 var(--lyra-space-s);
    margin-inline: 0;
    padding-inline-start: var(--lyra-space-m);
    border-inline-start: var(--lyra-border-width-thick) solid var(--lyra-color-border);
    color: var(--lyra-color-text-quiet);
  }
  [part='table'] {
    border-collapse: collapse;
    margin-block: 0 var(--lyra-space-s);
    inline-size: 100%;
    max-inline-size: 100%;
  }
  [part='table'] th,
  [part='table'] td {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    text-align: start;
  }
  [part='table'] th {
    background: var(--lyra-color-brand-quiet);
    font-weight: var(--lyra-font-weight-semibold);
  }
`;
