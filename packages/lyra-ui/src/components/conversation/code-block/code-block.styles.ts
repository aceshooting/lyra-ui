import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lr-font-size-sm);
  }
  [part='base'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    min-inline-size: 0;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    /* --lr-color-surface, not -brand-quiet: --lr-color-text-quiet (the toggle/copy-button color
       below) fails WCAG AA against --lr-color-brand-quiet in this palette. -surface is the same
       header background lr-json-viewer's toolbar uses with that same text color. */
    background: var(--lr-color-surface);
    font-family: var(--lr-font);
  }
  [part='toggle'] {
    /* Keep the glyph compact while giving the interactive box the shared
       minimum target size. */
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: var(--lr-color-text-quiet);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='toggle']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='toggle']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-brand);
  }
  [part='toggle'] .chevron {
    display: inline-flex;
    transition: transform var(--lr-transition-fast);
  }
  /* Chevron points at the content: rotated down while expanded, resting right while collapsed --
     same rotation direction as lr-thinking-panel's and lr-json-viewer's toggles. */
  :host(:not([collapsed])) [part='toggle'] .chevron {
    transform: rotate(90deg);
  }
  /* RTL: the collapsed chevron mirrors to point left, the conventional mirrored disclosure
     direction. Scoped to [collapsed] rather than a plain :dir(rtl) rule so it never competes with
     the rule above -- the expanded state needs no mirroring, since rotating this asymmetric glyph
     90deg already yields a symmetric down chevron. */
  :host([collapsed]:dir(rtl)) [part='toggle'] .chevron {
    transform: scaleX(-1);
  }
  [part='filename'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--lr-code-block-font, var(--lr-font-mono));
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='language'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--lr-size-0-0625rem) var(--lr-size-0-4375rem);
    border-radius: var(--lr-radius-pill);
    /* --lr-color-brand on -brand-quiet, not -text-quiet on -surface: the pill must read as distinct
       from the [part="header"] background it sits on (also -surface, per the comment above), and
       brand-on-brand-quiet is a pairing already relied on elsewhere here that passes contrast,
       unlike -text-quiet on -brand-quiet. */
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
    font-size: var(--lr-size-0-6875rem);
    line-height: var(--lr-line-height-1-4);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-02em);
  }
  /* Pushed to the end of the header whether or not filename/language precede it --
     margin-inline-start: auto works as the first flex child or the last of several. */
  [part='copy-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    border: none;
    background: none;
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-none);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-0-1875rem) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='copy-button']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-brand);
  }
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='body'] {
    display: block;
    max-block-size: var(--lr-code-block-max-height, none);
    overflow: auto;
  }
  [part='body'][hidden] {
    display: none;
  }
  [part='body']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    /* Negative (inward) so the ring isn't clipped by this element's own
       overflow:auto -- same reasoning as lr-virtual-list's [part="base"]. */
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='body'] lr-skeleton {
    display: block;
    padding: var(--lr-space-s) var(--lr-space-m);
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: var(--lr-size-8rem);
  }
  [part='pre'] {
    margin: 0;
    padding: var(--lr-space-s) var(--lr-space-m);
    /* The body owns scrolling, so this descendant's painted box must grow to the longest unwrapped
       line, not stop at the body's visible width. The 100% minimum keeps short code filling the
       scrollport; max-content extends the background and line-state painting through the full
       overflow range. */
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: 100%;
    /* Source code reads left-to-right whatever the document direction. Without this an ancestor
       dir="rtl" bidi-reorders each line (a trailing ';' jumps to the visual start, an opening brace
       wraps to its own bottom line) and right-aligns the block, so valid code looks syntactically
       broken. The header is a separate part and still mirrors. isolate stops an RTL run inside a
       string or comment leaking out and reordering the code. Matches phone-input's calling-code and
       terminal/stack-trace's dir="ltr" locks. */
    direction: ltr;
    unicode-bidi: isolate;
    /* A default background so the plain-fallback path still reads as a code block. shiki's own
       inline background-color (the generated-token-colors exception documented in code-block.ts's
       tokenize()) overrides it the moment highlighting succeeds, since a style attribute always
       beats an external rule at equal or lower specificity. */
    background: var(--lr-color-surface);
    font-family: var(--lr-code-block-font, var(--lr-font-mono));
    font-size: inherit;
    line-height: var(--lr-line-height-normal);
    white-space: pre;
    /* Tab width, defaulting to --lr-code-editor-tab-size so editable and read-only surfaces agree
       on a literal tab. A var() fallback, not a :host declaration: :host is re-stamped per instance
       and shadows any inherited value, so a page- or container-level declaration could never reach
       it. lr-markdown and lr-markdown-core carry the same fallback for their own code-block part --
       siblings, not descendants, so no one rule covers both. Never inline: shiki stamps its own
       style attribute on the <pre>, which a host override cannot beat. */
    tab-size: var(--lr-code-block-tab-size, 2);
  }
  /* One grid row per line, in BOTH line-numbers modes. A line must be a full-width row or the
     highlight background below paints behind the glyphs only -- a one-character highlighted line
     becomes an 8px swatch; this was once scoped to .line-numbers, so the default code block never
     got it. Grid rather than block because both renderers separate lines with a literal newline
     text node (shiki's output, and renderPlainCode()'s newline join, which keeps the textContent of
     <code> equal to the source): a block container boxes each into a blank row, doubling row
     spacing, while grid drops whitespace-only runs, so N lines render as N rows. The row tracks the
     grid's max-content column, which the <pre> sizes to the longest line, so the highlight extends
     through the full horizontal scroll range. */
  [part='code'] {
    display: grid;
    font-family: inherit;
  }
  [part='pre'] .line {
    display: block;
  }
  [part='pre'] .line-number {
    display: inline-block;
    min-inline-size: var(--lr-size-2-5ch);
    margin-inline-end: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    text-align: end;
    user-select: none;
  }
  /* A highlighted line, from highlight-lines or a line-range entry in highlights -- stamped
     identically by codeBlockLineTransformer (shiki) and renderPlainCode() (plain). See the
     dark-mode block below for why it needs its own !important there.
     --lr-code-block-highlighted-line-bg is a var() fallback, not a :host declaration, for the
     reason given at --lr-code-block-active-line-outline-color below; unset it resolves to
     --lr-color-warning-quiet. */
  [part='pre'] [data-highlighted] {
    background: var(--lr-code-block-highlighted-line-bg, var(--lr-color-warning-quiet));
  }
  /* The active highlight (the highlights entry matching activeHighlightId) adds an outline over any
     background -- inset, so it does not grow the line's box.
     --lr-code-block-active-line-outline-color is a var() fallback, not a :host declaration: :host
     is re-stamped per instance and would shadow any ancestor or theme value, which a state-styling
     override hook must not do. Unset it resolves to --lr-color-brand. */
  [part='pre'] [data-active] {
    outline: var(--lr-border-width-thin) solid var(--lr-code-block-active-line-outline-color, var(--lr-color-brand));
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }
  /* The gutter alone is interactive; source remains ordinary selectable text. */
  [part='pre'] button.line-gutter {
    display: inline-flex;
    align-items: center;
    justify-content: end;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: 0;
    margin-inline-end: var(--lr-space-s);
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  /* Both pointer arms carry the full [part='pre'] button.line-gutter compound, like the
     :focus-visible rule below. The resting rule directly above is (0,2,1) and declares background:
     none, so a :where()-zeroed (0,1,0) arm matches the button and then loses the background to it
     -- the gutter looked identical hovered, held and idle, while the keyboard path worked. Any
     rewrite must stay at least as specific as that resting rule. */
  [part='pre'] button.line-gutter:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='pre'] button.line-gutter:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='pre'] button.line-gutter:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Activates shiki's dual-themes dark variant. codeToHtml() (tokenize() in code-block.ts) renders
     each token's LIGHT color inline and stashes its DARK one in the --shiki-dark and
     --shiki-dark-bg properties shiki defines inline on the same elements; reassigning
     color/background-color from those variables in an external stylesheet is shiki's own documented
     toggle. !important is required because an inline style attribute outranks an external
     stylesheet at any specificity short of it. The one legitimate exception here to every color
     being a --lr-* token: these values are shiki's theme data, not this library's. */
  /* Gated on [part='body'][data-dark-theme='true'] (kept live by the shared ThemeWatcher off the
     component's resolved --lr-color-text and --lr-color-surface) rather than prefers-color-scheme
     -- a consumer who sets --lr-theme-color-* independently of the OS must still get the dark shiki
     theme, matching every --lr-color token's consumer-overrides-first resolution. */
  [part='body'][data-dark-theme='true'] [part='pre'],
  [part='body'][data-dark-theme='true'] [part='pre'] span {
    color: var(--shiki-dark, inherit) !important;
    background-color: var(--shiki-dark-bg, transparent) !important;
  }
  [part='body'][data-dark-theme='true'] [part='pre'] [data-highlighted] {
    background: var(--lr-code-block-highlighted-line-bg, var(--lr-color-warning-quiet)) !important;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] .chevron {
      transition: none !important;
    }
  }
`;
