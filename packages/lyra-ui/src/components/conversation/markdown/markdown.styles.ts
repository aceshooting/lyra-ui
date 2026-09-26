import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    line-height: var(--lr-line-height-loose);
    /* Consumer-tunable scroll cap; 'none' grows with the content like every other block-level
       component here until a caller opts into an internal scrollbar via the max-height
       attribute -- same rationale as lr-json-viewer's/lr-diff-view's identical
       --_lr-json-viewer-max-height/--_lr-diff-view-max-height. */
    --_lr-markdown-max-height: none;
  }
  [part='content'] {
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    max-block-size: var(--lr-markdown-max-height, var(--_lr-markdown-max-height));
    overflow-inline: auto;
    /* Paired with overflow-inline above: the CSS overflow spec resolves the other axis to 'auto',
       never 'visible', once one is pinned non-'visible'. Left implicit, a sub-pixel content/box
       mismatch on the block axis trips a spurious, non-interactive vertical scrollbar. Mirrors
       lr-tab-group's tablist fix (overflow-x: auto; overflow-y: hidden). This stays 'hidden' for
       the unset (default 'none' max-height) case; markdown-shared.ts's renderMarkdownContent()
       overrides it inline to 'auto' only once a max-height cap is actually in effect, so the
       spurious-scrollbar risk this rule guards against never returns for the capped case either. */
    overflow-block: hidden;
    overflow-wrap: anywhere;
  }
  [part='content'][data-unsanitized] {
    /* Unsanitized content may carry positioned descendants; clip that trusted-content escape hatch
       to this surface rather than let it cover the surrounding app. */
    contain: paint;
  }
  [part='streaming-tail'] {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  /* no-hover-state: these parts are scrollable prose surfaces, not pointer targets. The focus ring
     tells a keyboard user which overflowing region the arrow keys will scroll; a mouse user
     already scrolls by pointing, and tinting a block of rendered Markdown under the pointer would
     read as a selection, not an affordance. */
  [part='content']:focus-visible,
  [part='code-block']:focus-visible,
  [part='table-wrapper']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Shared by the streaming, still-loading and failure-fallback states. The template keeps its
     binding flush (markdown-shared.ts renderMarkdownContent), so this state shows exactly content. */
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
  ul > [part~='task-item'] {
    list-style: none;
  }
  [part~='task-checkbox'] {
    --_lr-markdown-task-box: var(--lr-markdown-task-checkbox-size, var(--lr-size-0-875em));
    appearance: none;
    box-sizing: border-box;
    display: inline-grid;
    place-content: center;
    inline-size: var(--_lr-markdown-task-box);
    block-size: var(--_lr-markdown-task-box);
    margin-block: 0;
    margin-inline: 0 var(--lr-space-s);
    vertical-align: middle;
    font-size: inherit;
    opacity: 1;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }
  ul > [part~='task-item'] > [part~='task-checkbox'],
  ul > [part~='task-item'] > p:first-child > [part~='task-checkbox'] {
    margin-inline-start: calc(-1 * (var(--_lr-markdown-task-box) + var(--lr-space-s)));
  }
  [part~='task-checkbox']:where(:checked) {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
  }
  /* A check mark reads the same in both directions, so its strokes never mirror. */
  [part~='task-checkbox']:where(:checked)::before {
    content: '';
    direction: ltr;
    inline-size: var(--lr-size-0-3em);
    block-size: var(--lr-size-0-5em);
    border: 0 solid var(--lr-color-on-brand);
    border-inline-end-width: var(--lr-border-width-medium);
    border-block-end-width: var(--lr-border-width-medium);
    transform: translateY(-10%) rotate(45deg);
  }
  [part='content'] code {
    font-family: var(--lr-markdown-font-mono, var(--lr-font-mono));
    font-size: var(--lr-size-0-875em);
    background: var(--lr-markdown-code-bg, var(--lr-color-brand-quiet));
    border-radius: var(--lr-markdown-code-radius, calc(var(--lr-radius) * 0.5));
    padding: var(--lr-markdown-code-padding, var(--lr-size-0-125rem) var(--lr-size-0-3125rem));
  }
  [part='code-block'] {
    margin-block: 0 var(--lr-space-s);
    padding: var(--lr-markdown-code-block-padding, var(--lr-space-s) var(--lr-space-m));
    border-radius: var(--lr-markdown-code-block-radius, var(--lr-radius));
    background: var(--lr-markdown-code-bg, var(--lr-color-brand-quiet));
    white-space: pre;
    overflow-wrap: normal;
    overflow-x: auto;
    overflow-y: hidden;
    overflow-inline: auto;
    /* See [part='content']'s identical overflow-block above -- same paired-axis rationale. */
    overflow-block: hidden;
    /* Deliberately the *shared* --lr-code-block-* name, not a --lr-markdown- one: one tab width
       should reach every code surface in the library. A var() fallback rather than a :host
       declaration, so a page- or container-level value can reach it; lr-code-block repeats it for
       its own <pre>, being a sibling rather than an ancestor. Every code surface preserves
       lines and scrolls horizontally, so literal tab stops agree. */
    tab-size: var(--lr-code-block-tab-size, 2);
  }
  [part='content'] :where(pre[part~='code-block']:not([dir]), code:not([dir], pre *)) {
    direction: ltr;
    unicode-bidi: isolate;
    text-align: start;
  }
  [part='content'] :where(pre:not([part~='code-block'], [dir])) {
    unicode-bidi: plaintext;
  }
  [part='content'][data-fallback] :where(.fallback-code, .fallback-inline-code) {
    direction: ltr;
    unicode-bidi: isolate;
  }
  [part='content'][data-fallback] .fallback-code {
    display: block;
    text-align: start;
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
    border-inline-start: var(--lr-border-width-thick) solid var(--lr-color-border-subtle);
    color: var(--lr-color-text-quiet);
  }
  [part='table-wrapper'] {
    margin-block: 0 var(--lr-space-s);
    overflow-x: auto;
    overflow-y: hidden;
    overflow-inline: auto;
    overflow-block: hidden;
  }
  [part='table'] {
    border-collapse: collapse;
    margin-block: 0 var(--lr-space-s);
    inline-size: 100%;
  }
  [part='table-wrapper'] > [part='table'] {
    margin-block: 0;
    overflow-wrap: break-word;
    word-break: normal;
  }
  [part='table'] th,
  [part='table'] td {
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part='table'] th:not([align]),
  [part='table'] td:not([align]) {
    text-align: start;
  }
  [part='table'] th {
    background: var(--lr-markdown-table-header-bg, var(--lr-color-brand-quiet));
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='math'][data-display='block'] {
    display: block;
    margin-block: var(--lr-space-s) var(--lr-space-s);
    white-space: pre;
    overflow-wrap: normal;
    overflow-x: auto;
    overflow-y: hidden;
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

  [part~='code-block-frame']:where([data-lr-code-chrome]) {
    margin-block: 0 var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-markdown-code-block-radius, var(--lr-radius));
    overflow: clip;
  }
  [part~='code-block-frame']:where([data-lr-code-chrome]) > [part='code-block'] {
    margin: 0;
    border-radius: 0;
  }
  [part~='code-block-header']:where([data-lr-code-chrome]) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding-inline: var(--lr-space-s) var(--lr-space-2xs);
    background: var(--lr-markdown-code-header-bg, var(--lr-color-surface));
    color: var(--lr-markdown-code-header-color, var(--lr-color-text-quiet));
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    font: var(--lr-font-size-xs)/var(--lr-line-height-normal) var(--lr-font);
    user-select: none;
  }
  [part~='code-block-language']:where([data-lr-code-chrome]) {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: ltr;
    unicode-bidi: isolate;
  }
  [part~='code-block-language']:where([data-lr-code-chrome])::before {
    content: attr(data-language);
  }
  [part~='code-block-copy']:where([data-lr-code-chrome]) {
    margin-inline-start: auto;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part~='code-block-copy']:where([data-lr-code-chrome]) svg {
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
  }
  [part~='code-block-copy']:where([data-lr-code-chrome]:hover) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part~='code-block-copy']:where([data-lr-code-chrome]:active) {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part~='code-block-copy']:where([data-lr-code-chrome]):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  @media (forced-colors: active) {
    [part~='code-block-copy']:where([data-lr-code-chrome]) {
      border: var(--lr-border-width-thin) solid ButtonText;
    }
  }
  [part~='code-block-copy-success']:where([data-lr-code-chrome]) {
    color: var(--lr-color-success);
  }
  [part~='code-block-copy-error']:where([data-lr-code-chrome]) {
    color: var(--lr-color-danger);
  }
`;
