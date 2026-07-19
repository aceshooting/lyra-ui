import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap -- 'none' means the block grows with its
       content, matching every other block-level component in this library
       until a caller opts in via the max-height attribute (same convention
       as --lr-json-viewer-max-height). */
    --lr-code-block-max-height: none;
    /* Contained here rather than left as a bare font-family literal so a
       host page can retheme it -- same rationale as --lr-markdown-font-mono
       and --lr-json-viewer-font, no shared --lr-* monospace token
       exists to resolve through. */
    --lr-code-block-font: var(--lr-font-mono);
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
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    /* --lr-color-surface (not -brand-quiet) -- pairing
       --lr-color-text-quiet (the toggle/copy-button color below) against
       --lr-color-brand-quiet fails WCAG AA contrast in this token
       palette; --lr-color-surface is the same header background
       lr-json-viewer's own toolbar already uses with that same text
       color. */
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
  [part='toggle'] .chevron {
    display: inline-flex;
    transition: transform var(--lr-transition-fast);
  }
  /* Chevron points at the content: rotated (pointing down) while expanded,
     resting (pointing right) while collapsed -- same rotation direction as
     lr-thinking-panel's and lr-json-viewer's own toggles. */
  :host(:not([collapsed])) [part='toggle'] .chevron {
    transform: rotate(90deg);
  }
  /* RTL: the resting (collapsed) chevron mirrors to point left, the
     conventional mirrored disclosure-triangle direction for RTL. Scoped to
     [collapsed] specifically (rather than a plain :dir(rtl) rule) so it
     never has to compete with the rule above for the expanded state, which
     needs no mirroring: rotating this left-right-asymmetric glyph 90deg
     already produces a left-right-symmetric down chevron. */
  :host([collapsed]:dir(rtl)) [part='toggle'] .chevron {
    transform: scaleX(-1);
  }
  [part='filename'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--lr-code-block-font);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='language'] {
    flex: 0 0 auto;
    padding: var(--lr-size-0-0625rem) var(--lr-size-0-4375rem);
    border-radius: var(--lr-radius-pill);
    /* --lr-color-brand + -brand-quiet (not -text-quiet + -surface) --
       this pill needs to read as distinct from the [part="header"]
       background it sits on (also -surface as of the comment above), and
       -brand on -brand-quiet is a pairing already relied on elsewhere in
       this library (e.g. hover states below) that passes contrast, unlike
       -text-quiet on -brand-quiet. */
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
    font-size: var(--lr-size-0-6875rem);
    line-height: var(--lr-line-height-1-4);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-02em);
  }
  /* Pushed to the end of the header whether or not filename/language
     precede it -- margin-inline-start:auto works whether this is the first
     flex child (copyable alone) or the last of several. */
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
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='body'] {
    display: block;
    max-block-size: var(--lr-code-block-max-height);
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
    /* A default background so the plain-fallback path still reads as a
       proper code block -- shiki's own inline background-color (part of the
       generated-token-colors exception documented in code-block.ts's
       tokenize()) silently overrides this the moment highlighting succeeds,
       since an element's own style attribute always wins over an external
       stylesheet rule at equal or lower specificity. */
    background: var(--lr-color-surface);
    font-family: var(--lr-code-block-font);
    font-size: inherit;
    line-height: var(--lr-line-height-normal);
    white-space: pre;
  }
  [part='code'] {
    font-family: inherit;
  }
  [part='pre'].line-numbers {
    counter-reset: lr-code-line;
  }
  [part='pre'].line-numbers .line {
    display: block;
    counter-increment: lr-code-line;
  }
  [part='pre'].line-numbers .line::before {
    content: counter(lr-code-line);
    display: inline-block;
    min-inline-size: var(--lr-size-2-5ch);
    margin-inline-end: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    text-align: end;
    user-select: none;
  }
  /* A highlighted line, from either highlight-lines or a line-range entry in highlights --
     stamped identically by codeBlockLineTransformer (shiki path) and renderPlainCode() (plain
     path). See the dark-mode block below for why this needs its own !important there. */
  [part='pre'] [data-highlighted] {
    background: var(--lr-color-warning-quiet);
  }
  /* The active highlight (highlights entry matching activeHighlightId) gets an outline on top of
     any background -- inset so it doesn't add to the line's own box size. */
  [part='pre'] [data-active] {
    outline: var(--lr-border-width-thin) solid var(--lr-color-brand);
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }
  /* Native button reset for interactive-lines' gutter-button rendering (renderPlainCode() only --
     the shiki-highlighted path doesn't render gutter buttons, see the class doc) -- an interactive
     line's <button class="line"> must look like the plain <span class="line"> it replaces. */
  [part='pre'] button.line {
    display: block;
    inline-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='pre'] button.line:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='pre'] button.line:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /*
   * Activates shiki's "dual themes" dark variant. codeToHtml() (see
   * tokenize() in code-block.ts) renders every token with its *light* color
   * as a plain inline color/background-color and its *dark* color stashed in
   * the --shiki-dark/--shiki-dark-bg custom properties shiki itself defines
   * inline on the same elements -- shiki's own documented pattern for
   * toggling them is exactly this: an external stylesheet rule that
   * reassigns color/background-color from those variables. This requires
   * !important because an inline style="..." attribute always outranks an
   * external stylesheet at any selector specificity short of !important --
   * there's no other way for a page-level rule to override an element's own
   * style attribute. This is the one legitimate exception to "every color is
   * a --lr-* token" in this file: these values come from shiki's theme
   * data, not this library's design tokens.
   */
  @media (prefers-color-scheme: dark) {
    [part='pre'],
    [part='pre'] span {
      color: var(--shiki-dark, inherit) !important;
      background-color: var(--shiki-dark-bg, transparent) !important;
    }
    /* The line-highlight background above is a --lr-* token, not shiki theme data, but a
       highlighted line in the shiki path is still a span, matched (and !important-overridden) by
       the dark-mode rule right above -- re-assert it here at matching specificity+importance so a
       highlighted line stays visible in dark mode instead of silently losing its background. */
    [part='pre'] [data-highlighted] {
      background: var(--lr-color-warning-quiet) !important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] .chevron {
      transition: none !important;
    }
  }
`;
