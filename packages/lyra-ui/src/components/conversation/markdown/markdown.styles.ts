import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Contained here (rather than left as a bare font-family literal) so a
       host page can retheme it -- same rationale as lr-json-viewer's
       identical --lr-json-viewer-font, no shared --lr-*
       monospace token exists to resolve through. */
    --lr-markdown-font-mono: var(--lr-font-mono);
    line-height: var(--lr-line-height-loose);
  }
  [part='content'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-inline: auto;
    /* Paired with overflow-inline above: per the CSS overflow spec, pinning one axis to a
       non-'visible' value forces the browser to resolve the other to 'auto' too (never
       'visible') -- left implicit, a sub-pixel content/box mismatch on the block axis can trip a
       spurious, non-interactive vertical scrollbar even though nothing here needs one. Mirrors
       lr-tabs's tablist fix (overflow-x: auto; overflow-y: hidden) for the identical bug. */
    overflow-block: hidden;
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
    line-height: var(--lr-line-height-compact);
    margin-block: var(--lr-space-l) var(--lr-space-s);
  }
  [part='content'] p,
  [part='content'] ul,
  [part='content'] ol {
    margin-block: 0 var(--lr-space-s);
  }
  [part='content'] code {
    font-family: var(--lr-markdown-font-mono);
    font-size: var(--lr-size-0-875em);
    background: var(--lr-color-brand-quiet);
    border-radius: calc(var(--lr-radius) * 0.5);
    padding: var(--lr-size-0-125rem) var(--lr-size-0-3125rem);
  }
  [part='code-block'] {
    margin-block: 0 var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand-quiet);
    overflow-inline: auto;
    /* See [part='content']'s identical overflow-block above -- same paired-axis rationale. */
    overflow-block: hidden;
    /* Deliberately the *shared* --lr-code-block-* name, not a --lr-markdown- one: a consumer setting
       one tab width expects every code surface in the library to honour it. The default lives here
       as a var() fallback rather than a :host declaration so a page- or container-level value can
       actually reach it; lr-code-block carries the same fallback for its own <pre>, since it is a
       sibling custom element rather than an ancestor and no single rule covers both.
       Same value, but not necessarily the same look: this part inherits pre-wrap from
       [part='content'] while lr-code-block's <pre> is white-space: pre, and tab stops are measured
       from the start of each visual line, so a wrapped markdown code line restarts them. */
    tab-size: var(--lr-code-block-tab-size, 2);
  }
  [part='code-block'] code {
    padding: 0;
    background: none;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }
  [part='link'] {
    color: var(--lr-color-brand);
    text-underline-offset: var(--lr-size-0-125rem);
  }
  /* Keeps an oversized source image from overflowing the content wrapper --
     matches the overflow-wrap: anywhere guard on [part='content'] above,
     which only covers text, not replaced elements like <img>. */
  [part='img'] {
    max-inline-size: 100%;
  }
  [part='blockquote'] {
    margin-block: 0 var(--lr-space-s);
    margin-inline: 0;
    padding-inline-start: var(--lr-space-m);
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
  }
  [part='table'] {
    border-collapse: collapse;
    margin-block: 0 var(--lr-space-s);
    inline-size: 100%;
    max-inline-size: 100%;
  }
  [part='table'] th,
  [part='table'] td {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding: var(--lr-space-xs) var(--lr-space-s);
    text-align: start;
  }
  [part='table'] th {
    background: var(--lr-color-brand-quiet);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='math'][data-display='block'] {
    display: block;
    margin-block: var(--lr-space-s) var(--lr-space-s);
    overflow-inline: auto;
    /* See [part='content']'s identical overflow-block above -- same paired-axis rationale. */
    overflow-block: hidden;
    text-align: center;
  }
  [part='math'][data-display='inline'] {
    display: inline-block;
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
`;
