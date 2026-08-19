import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-docx-viewer-max-height: none;
  }

  [part="base"] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }

  [part="body"] {
    box-sizing: border-box;
    overflow: auto;
    max-block-size: var(
      --lr-docx-viewer-max-height,
      var(--_lr-docx-viewer-max-height)
    );
    padding: var(--lr-space-l);
  }

  [part="content"] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
    overflow-wrap: break-word;
  }

  [part="content"] > :first-child {
    margin-block-start: 0;
  }

  [part="content"] > :last-child {
    margin-block-end: 0;
  }

  [part="content"] h1,
  [part="content"] h2,
  [part="content"] h3,
  [part="content"] h4,
  [part="content"] h5,
  [part="content"] h6 {
    line-height: var(--lr-line-height-compact);
    margin-block: var(--lr-space-l) var(--lr-space-s);
  }

  [part="content"] p,
  [part="content"] ul,
  [part="content"] ol {
    margin-block: 0 var(--lr-space-s);
  }

  [part="content"] img {
    max-inline-size: 100%;
    block-size: auto;
  }

  [part="content"] table {
    border-collapse: collapse;
    margin-block: 0 var(--lr-space-s);
    inline-size: 100%;
  }

  [part="content"] th,
  [part="content"] td {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding: var(--lr-space-xs) var(--lr-space-s);
    text-align: start;
  }

  [part="content"] th {
    background: var(--lr-color-brand-quiet);
    font-weight: var(--lr-font-weight-semibold);
  }

  .empty-note {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }

  [part="error"] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }

  [part="highlight-actions"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-m);
  }

  [part="highlight-action"] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-brand);
    font: inherit;
    cursor: pointer;
  }

  [part="highlight-action"]:hover {
    background: var(--lr-color-brand-quiet);
  }

  [part="highlight-action"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part="highlight-action"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  /* Painted text-quote highlights, two paths kept in sync by tone: the CSS Custom Highlight API
     path styles the native ::highlight() pseudo -- no element exists, so the mark[...] selectors
     below never match there -- while the <mark>-wrap fallback styles real elements
     text-highlights.ts creates here. */
  ::highlight(lr-highlight-accent) {
    background-color: var(
      --lr-docx-viewer-highlight-accent-background,
      var(--lr-color-brand-quiet)
    );
  }
  ::highlight(lr-highlight-success) {
    background-color: var(
      --lr-docx-viewer-highlight-success-background,
      var(--lr-color-success-quiet)
    );
  }
  ::highlight(lr-highlight-warning) {
    background-color: var(
      --lr-docx-viewer-highlight-warning-background,
      var(--lr-color-warning-quiet)
    );
  }
  ::highlight(lr-highlight-danger) {
    background-color: var(
      --lr-docx-viewer-highlight-danger-background,
      var(--lr-color-danger-quiet)
    );
  }
  /* --lr-color-surface-raised, not --lr-color-surface: [part='content'] paints no background, so
     it shows [part='base']'s --lr-color-surface, and falling back to that token would leave a
     neutral highlight with zero contrast against the text it marks. Matches highlight-layer's
     neutral fallback. */
  ::highlight(lr-highlight-neutral) {
    background-color: var(
      --lr-docx-viewer-highlight-neutral-background,
      var(--lr-color-surface-raised)
    );
  }
  ::highlight(lr-highlight-active) {
    background-color: var(
      --lr-docx-viewer-highlight-active-background,
      var(--lr-color-brand-quiet)
    );
    text-decoration: underline;
  }
  /* Each tone resolves into one private carrier so the hover/active rules below have a single base
     to mix from: a directly declared tone background is invisible to the generic
     mark[data-lr-highlight-tone]:hover rule. Same shape as lr-highlight-layer's
     --_lr-highlight-layer-background. */
  [part="content"] mark[data-lr-highlight-tone] {
    --_lr-docx-viewer-highlight-background: var(
      --lr-docx-viewer-highlight-accent-background,
      var(--lr-color-brand-quiet)
    );
    background: var(--_lr-docx-viewer-highlight-background);
    color: inherit;
    border-radius: calc(var(--lr-radius) * 0.5);
    cursor: pointer;
  }
  /* A mark wraps document TEXT and brightness() applies to the whole subtree, so it recoloured the
     quoted words with their highlight; as a channel multiply it also did nothing to a pure white or
     pure black highlight and moved every other one whichever way its colour sat. Mixing the tone's
     background toward --lr-color-mix-partner (the text colour) leaves the text alone and always
     moves. */
  [part="content"] mark[data-lr-highlight-tone]:hover {
    background: color-mix(
      in oklab,
      var(--_lr-docx-viewer-highlight-background),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="content"] mark[data-lr-highlight-tone]:active {
    background: color-mix(
      in oklab,
      var(--_lr-docx-viewer-highlight-background),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="content"] mark[data-lr-highlight-tone="success"] {
    --_lr-docx-viewer-highlight-background: var(
      --lr-docx-viewer-highlight-success-background,
      var(--lr-color-success-quiet)
    );
  }
  [part="content"] mark[data-lr-highlight-tone="warning"] {
    --_lr-docx-viewer-highlight-background: var(
      --lr-docx-viewer-highlight-warning-background,
      var(--lr-color-warning-quiet)
    );
  }
  [part="content"] mark[data-lr-highlight-tone="danger"] {
    --_lr-docx-viewer-highlight-background: var(
      --lr-docx-viewer-highlight-danger-background,
      var(--lr-color-danger-quiet)
    );
  }
  [part="content"] mark[data-lr-highlight-tone="neutral"] {
    --_lr-docx-viewer-highlight-background: var(
      --lr-docx-viewer-highlight-neutral-background,
      var(--lr-color-surface-raised)
    );
  }
  [part="content"] mark[data-lr-highlight-name="lr-highlight-active"] {
    outline: var(--lr-border-width-thin) solid
      var(--lr-docx-viewer-highlight-active-outline, var(--lr-color-brand));
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="content"] mark[part~="search-match"] {
    background: var(
      --lr-docx-viewer-search-match-background,
      var(--lr-color-warning-quiet)
    );
    color: inherit;
    border-radius: var(--lr-radius-xs);
  }
  [part="content"] mark[part~="search-match-active"] {
    background: var(
      --lr-docx-viewer-search-match-active-background,
      var(--lr-color-warning)
    );
    color: var(
      --lr-docx-viewer-search-match-active-foreground,
      var(--lr-color-on-warning)
    );
  }
`;
