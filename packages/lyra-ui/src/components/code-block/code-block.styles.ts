import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable scroll cap -- 'none' means the block grows with its
       content, matching every other block-level component in this library
       until a caller opts in via the max-height attribute (same convention
       as --lyra-json-viewer-max-height). */
    --lyra-code-block-max-height: none;
    /* Contained here rather than left as a bare font-family literal so a
       host page can retheme it -- same rationale as --lyra-markdown-font-mono
       and --lyra-json-viewer-font, no shared --wa-*/--lyra-* monospace token
       exists to resolve through. */
    --lyra-code-block-font: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8125rem;
  }
  [part='base'] {
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: 1px solid var(--lyra-color-border);
    /* --lyra-color-surface (not -brand-quiet) -- pairing
       --lyra-color-text-quiet (the toggle/copy-button color below) against
       --lyra-color-brand-quiet fails WCAG AA contrast in this token
       palette; --lyra-color-surface is the same header background
       lyra-json-viewer's own toolbar already uses with that same text
       color. */
    background: var(--lyra-color-surface);
    font-family: var(--lyra-font);
  }
  [part='toggle'] {
    /* Deliberately smaller than the shared --lyra-icon-button-size (2.5rem,
       meant for a standalone icon-only button) -- this sits inline in a
       dense header row, same reasoning as lyra-json-viewer's own toggle. */
    inline-size: 1.25rem;
    block-size: 1.25rem;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='toggle']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='toggle'] .chevron {
    display: inline-flex;
    transition: transform var(--lyra-transition-fast);
  }
  /* Chevron points at the content: rotated (pointing down) while expanded,
     resting (pointing right) while collapsed -- same rotation direction as
     lyra-thinking-panel's and lyra-json-viewer's own toggles. */
  :host(:not([collapsed])) [part='toggle'] .chevron {
    transform: rotate(90deg);
  }
  [part='filename'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--lyra-code-block-font);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--lyra-color-text);
  }
  [part='language'] {
    flex: 0 0 auto;
    padding: 0.0625rem 0.4375rem;
    border-radius: 999px;
    /* --lyra-color-brand + -brand-quiet (not -text-quiet + -surface) --
       this pill needs to read as distinct from the [part="header"]
       background it sits on (also -surface as of the comment above), and
       -brand on -brand-quiet is a pairing already relied on elsewhere in
       this library (e.g. hover states below) that passes contrast, unlike
       -text-quiet on -brand-quiet. */
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
    font-size: 0.6875rem;
    line-height: 1.4;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  /* Pushed to the end of the header whether or not filename/language
     precede it -- margin-inline-start:auto works whether this is the first
     flex child (copyable alone) or the last of several. */
  [part='copy-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    border: none;
    background: none;
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: 0.75rem;
    line-height: 1;
    padding: 0.1875rem var(--lyra-space-xs);
    border-radius: var(--lyra-radius);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='toggle']:focus-visible,
  [part='copy-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='body'] {
    display: block;
    max-block-size: var(--lyra-code-block-max-height);
    overflow: auto;
  }
  [part='body'][hidden] {
    display: none;
  }
  [part='body']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    /* Negative (inward) so the ring isn't clipped by this element's own
       overflow:auto -- same reasoning as lyra-virtual-list's [part="base"]. */
    outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
  }
  [part='body'] lyra-skeleton {
    display: block;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    --lyra-skeleton-w: 100%;
    --lyra-skeleton-h: 8rem;
  }
  [part='pre'] {
    margin: 0;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    /* A default background so the plain-fallback path still reads as a
       proper code block -- shiki's own inline background-color (part of the
       generated-token-colors exception documented in code-block.ts's
       tokenize()) silently overrides this the moment highlighting succeeds,
       since an element's own style attribute always wins over an external
       stylesheet rule at equal or lower specificity. */
    background: var(--lyra-color-surface);
    font-family: var(--lyra-code-block-font);
    font-size: inherit;
    line-height: 1.5;
    white-space: pre;
  }
  [part='code'] {
    font-family: inherit;
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
   * a --lyra-* token" in this file: these values come from shiki's theme
   * data, not this library's design tokens.
   */
  @media (prefers-color-scheme: dark) {
    [part='pre'],
    [part='pre'] span {
      color: var(--shiki-dark, inherit) !important;
      background-color: var(--shiki-dark-bg, transparent) !important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] .chevron {
      transition: none !important;
    }
  }
`;
