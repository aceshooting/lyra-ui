import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap; 'none' grows with the content like every other block-level
       component here until a caller opts into an internal scrollbar via the max-height
       attribute -- same rationale as lr-json-viewer's identical --_lr-json-viewer-max-height. */
    --_lr-diff-view-max-height: none;
    --_lr-diff-view-font: var(--lr-font-mono);
    --_lr-diff-view-add-background: var(--lr-color-success-quiet);
    --_lr-diff-view-add-color: var(--lr-color-success);
    --_lr-diff-view-remove-background: var(--lr-color-danger-quiet);
    --_lr-diff-view-remove-color: var(--lr-color-danger);
    --_lr-diff-view-fold-background: var(--lr-color-surface-raised);
    --_lr-diff-view-fold-color: var(--lr-color-text-quiet);
  }
  [part="base"] {
    position: relative;
    max-block-size: var(--lr-diff-view-max-height, var(--_lr-diff-view-max-height));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: auto;
  }
  pre {
    margin: 0;
    padding: var(--lr-space-s);
  }
  [part="limit"] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  .split-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--lr-space-s);
    align-items: start;
    padding: var(--lr-space-s);
  }
  [part="side"] {
    overflow-x: auto;
    overflow-y: hidden;
    min-inline-size: 0;
  }
  [part="line"] {
    /* Here rather than on the ancestor pre element so layout="split" -- whose lines sit inside
       [part='side'], not a pre -- gets the same monospace typography as the default unified pre.
       font-family, font-size and line-height are all inheritable, so the move is visually identical
       for the unified layout: same computed values, set directly instead of inherited. */
    font-family: var(--lr-diff-view-font, var(--_lr-diff-view-font));
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    white-space: pre-wrap;
    /* The base/side owns horizontal scrolling while each line owns its change-state background.
       Grow that painted box with an unbroken line, but keep short lines filling the scrollport. */
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: 100%;
  }
  [part="line"]:not([data-type="fold"]) {
    /* Diffed source reads left-to-right whatever the document direction -- same rationale and fix
       shape as code-block.styles.ts's [part='pre']: without this an ancestor dir="rtl"
       bidi-reorders each line and right-aligns the block, making valid code look syntactically
       broken. isolate stops an RTL run inside a string or comment leaking out and reordering the
       code around it. [data-type='fold'] is excluded: it renders a localized message ("N unchanged
       lines"), not code, and must follow the ambient, possibly RTL, direction like ordinary UI
       text. */
    direction: ltr;
    unicode-bidi: isolate;
  }
  [part="line"][data-type="add"] {
    background: var(
      --lr-diff-view-add-background,
      var(--_lr-diff-view-add-background)
    );
    color: var(--lr-diff-view-add-color, var(--_lr-diff-view-add-color));
  }
  [part="line"][data-type="remove"] {
    background: var(
      --lr-diff-view-remove-background,
      var(--_lr-diff-view-remove-background)
    );
    color: var(--lr-diff-view-remove-color, var(--_lr-diff-view-remove-color));
  }
  [part="line"][data-type="fold"] {
    color: var(--lr-diff-view-fold-color, var(--_lr-diff-view-fold-color));
    background: var(
      --lr-diff-view-fold-background,
      var(--_lr-diff-view-fold-background)
    );
    text-align: center;
  }
  /* --lr-diff-view-match-color, not the bare --lr-color-warning, so a consumer can retint a
     non-active search match without touching every warning-toned surface on the page reading that
     shared token -- as --lr-diff-view-active-match-color does below for the active match. */
  [part="line"][data-match] {
    outline: var(--lr-border-width-thin) dashed var(--lr-diff-view-match-color, var(--lr-color-warning));
  }
  [part="line"][data-active-match] {
    outline: var(--lr-border-width-medium) solid var(--lr-diff-view-active-match-color, var(--lr-color-warning));
  }
  /* Host-supplied highlights. Placed after the data-type add/remove rules above so an equal-specificity
     background tie resolves in the highlight's favor -- a highlighted added/removed line reads as
     highlighted, not as its change-state color. Each tone resolves into one private carrier so the
     row tint and the action button read from a single base, on the same quiet fill tokens used
     elsewhere in this family. Neutral takes --lr-color-surface-raised, not --lr-color-surface:
     tinting a row with the viewer's own background would render it unhighlighted. */
  [part="line"][data-highlight] {
    --_lr-diff-view-highlight-background: var(--lr-diff-view-highlight-accent-background, var(--lr-color-brand-quiet));
    background: var(--_lr-diff-view-highlight-background);
  }
  [part="line"][data-highlight="success"] {
    --_lr-diff-view-highlight-background: var(--lr-diff-view-highlight-success-background, var(--lr-color-success-quiet));
  }
  [part="line"][data-highlight="warning"] {
    --_lr-diff-view-highlight-background: var(--lr-diff-view-highlight-warning-background, var(--lr-color-warning-quiet));
  }
  [part="line"][data-highlight="danger"] {
    --_lr-diff-view-highlight-background: var(--lr-diff-view-highlight-danger-background, var(--lr-color-danger-quiet));
  }
  [part="line"][data-highlight="neutral"] {
    --_lr-diff-view-highlight-background: var(--lr-diff-view-highlight-neutral-background, var(--lr-color-surface-raised));
  }
  [part="line"][data-active-highlight] {
    outline: var(--lr-border-width-medium) solid var(--lr-diff-view-highlight-active-outline, var(--lr-color-brand));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="line-highlight-action"] {
    display: inline-block;
    margin-inline-start: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
  }
  [part="line-highlight-action"]:hover {
    background: var(--_lr-diff-view-highlight-background);
  }
  [part="line-highlight-action"]:active {
    background: color-mix(in oklab, var(--_lr-diff-view-highlight-background), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part="line-highlight-action"]:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="copy-button"] {
    position: absolute;
    inset-block-start: var(--lr-space-xs);
    inset-inline-end: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-s);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part="copy-button"]:hover {
    border-color: var(--lr-color-brand);
  }
  [part="copy-button"]:active {
    border-color: var(--lr-color-brand);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="copy-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
