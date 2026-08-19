import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    line-height: var(--lr-line-height-loose);
  }
  [part='content'] {
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    overflow-inline: auto;
    /* Paired with overflow-inline above: the CSS overflow spec resolves the other axis to 'auto',
       never 'visible', once one is pinned non-'visible'. Left implicit, a sub-pixel content/box
       mismatch on the block axis trips a spurious, non-interactive vertical scrollbar. Mirrors
       lr-tab-group's tablist fix (overflow-x: auto; overflow-y: hidden). */
    overflow-block: hidden;
    overflow-wrap: anywhere;
  }
  [part='content'][data-unsanitized] {
    /* Unsanitized content may carry positioned descendants; clip that trusted-content escape hatch
       to this surface rather than let it cover the surrounding app. */
    contain: paint;
  }
  /* no-hover-state: both parts are scrollable prose surfaces, not pointer targets. The focus ring
     tells a keyboard user which overflowing region the arrow keys will scroll; a mouse user
     already scrolls by pointing, and tinting a block of rendered Markdown under the pointer would
     read as a selection, not an affordance. */
  [part='content']:focus-visible,
  [part='code-block']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Shared by the still-loading and failure-fallback states -- see the renderedHtml field doc in
     markdown.ts. */
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
    font-family: var(--lr-markdown-font-mono, var(--lr-font-mono));
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
    /* Deliberately the *shared* --lr-code-block-* name, not a --lr-markdown- one: one tab width
       should reach every code surface in the library. A var() fallback rather than a :host
       declaration, so a page- or container-level value can reach it; lr-code-block repeats it for
       its own <pre>, being a sibling rather than an ancestor. Same value, different look: this
       part inherits pre-wrap from [part='content'] while that <pre> is white-space: pre, and tab
       stops measure from each visual line's start, so a wrapped line restarts them. */
    tab-size: var(--lr-code-block-tab-size, 2);
  }
  [part='code-block'] code {
    padding: 0;
    background: none;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }
  /*
   * Activates shiki's dual-themes dark variant for highlighted fenced blocks, as
   * code-block.styles.ts does for lr-code-block's pre. tokenizeMarkdownHighlight() renders each
   * token's light color inline and stashes the dark one in --shiki-dark/--shiki-dark-bg on the
   * same element; shiki's documented toggle reassigns color/background-color from those variables.
   * !important is required because an inline style attribute outranks an external stylesheet at
   * any specificity. The values are shiki theme data, not this library's design tokens -- the one
   * deliberate exception in this file.
   *
   * Gated on [data-dark-theme='true'], kept live by the shared ThemeWatcher off the resolved
   * --lr-color-text/--lr-color-surface rather than the OS-level prefers-color-scheme query, so a
   * consumer setting --lr-theme-color-* explicitly still gets the dark shiki palette.
   */
  [part='content'][data-dark-theme='true'] [part='code-block'],
  [part='content'][data-dark-theme='true'] [part='code-block'] span {
    color: var(--shiki-dark, inherit) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }
  [part='link'] {
    color: var(--lr-color-brand);
    text-underline-offset: var(--lr-size-0-125rem);
  }
  /* Keeps an oversized source image inside the content wrapper: [part='content']'s
     overflow-wrap: anywhere covers text only, not replaced elements like <img>. */
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
  /* Painted text-quote highlights. The CSS Custom Highlight API path styles the native
     ::highlight() pseudo, where no element exists for the [part='content'] mark[...] selectors
     below to match; the <mark>-wrap fallback styles the real elements text-highlights.ts creates
     in this same shadow tree. Both are kept in sync by tone. */
  ::highlight(lr-highlight-accent) {
    background-color: var(--lr-markdown-highlight-accent-bg, var(--lr-color-brand-quiet));
  }
  ::highlight(lr-highlight-success) {
    background-color: var(--lr-markdown-highlight-success-bg, var(--lr-color-success-quiet));
  }
  ::highlight(lr-highlight-warning) {
    background-color: var(--lr-markdown-highlight-warning-bg, var(--lr-color-warning-quiet));
  }
  ::highlight(lr-highlight-danger) {
    background-color: var(--lr-markdown-highlight-danger-bg, var(--lr-color-danger-quiet));
  }
  ::highlight(lr-highlight-neutral) {
    background-color: var(--lr-markdown-highlight-neutral-bg, var(--lr-color-surface));
  }
  ::highlight(lr-highlight-active) {
    background-color: var(--lr-markdown-highlight-active-bg, var(--lr-color-brand-quiet));
    text-decoration: underline;
  }
  [part='content'] mark[data-lr-highlight-tone] {
    background: var(--lr-markdown-highlight-accent-bg, var(--lr-color-brand-quiet));
    color: inherit;
    border-radius: calc(var(--lr-radius) * 0.5);
  }
  [part='content'] mark[data-lr-highlight-tone='success'] {
    background: var(--lr-markdown-highlight-success-bg, var(--lr-color-success-quiet));
  }
  [part='content'] mark[data-lr-highlight-tone='warning'] {
    background: var(--lr-markdown-highlight-warning-bg, var(--lr-color-warning-quiet));
  }
  [part='content'] mark[data-lr-highlight-tone='danger'] {
    background: var(--lr-markdown-highlight-danger-bg, var(--lr-color-danger-quiet));
  }
  [part='content'] mark[data-lr-highlight-tone='neutral'] {
    background: var(--lr-markdown-highlight-neutral-bg, var(--lr-color-surface));
  }
  [part='content'] mark[data-lr-highlight-name='lr-highlight-active'] {
    outline: var(--lr-border-width-thin) solid var(--lr-markdown-highlight-active-outline-color, var(--lr-color-brand));
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
