import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    vertical-align: middle;
    /* One custom-property trio swapped by the :host([tone]) rules below,
       rather than repeating background/color/border per part per tone —
       mirrors lr-tool-call-chip's/lr-attachment-chip's identical
       -accent/-bg/-border trio so a chip's tone vocabulary reads the same
       everywhere in the library. 'neutral' has no dedicated token pair (see
       the class doc), so it falls back to plain surface/border/text instead
       of inventing a sixth tint. */
    --lr-chip-accent: var(--lr-color-text);
    --lr-chip-bg: var(--lr-color-surface);
    --lr-chip-border: var(--lr-color-border);
    /* The medium defaults exactly reproduce the original fixed chip treatment. */
    --lr-chip-font-size: var(--lr-font-size-sm);
    --lr-chip-padding-block: var(--lr-size-0-25rem);
    --lr-chip-padding-inline: var(--lr-space-s);
    --lr-chip-gap: var(--lr-space-xs);
    --lr-chip-icon-size: var(--lr-font-size-sm);
    /* Interactive (removable/toggleable) chips floor their tap target here. The compact tiers
       share the 24px WCAG 2.2 SC 2.5.8 minimum -- an interactive chip must never shrink below it,
       so 2xs/xs/s/m keep 1.5rem. The larger tiers reassign a taller floor (below their own
       content-driven height, so it stays byte-identical until raised) so xl and 2xs no longer
       share a single 1.5rem value. Non-interactive display chips get no floor from this at all
       -- see [part='base'] below. */
    --lr-chip-min-height: var(--lr-size-1-5rem);
    /* --lr-chip-height is intentionally NOT declared here. It is a consumer-facing exact-height
       escape hatch consumed only through the var() fallbacks on [part='base'] below; declaring
       any value for it (even 'auto') would make those fallback arms unreachable and turn
       --lr-chip-min-height into dead code (the lr-select trap). Left undeclared, both arms stay
       live: the per-tier floor falls out of the fallback, and setting the property pins an exact
       height. A value small enough to break the interactive 24x24 target is for
       non-interactive chips only. */
  }

  :host([size='3xs']) {
    --lr-chip-font-size: var(--lr-font-size-3xs);
    --lr-chip-padding-block: 0;
    /* Below --lr-space-2xs (the space scale's own floor, still used by the 2xs tier) --
       same precedent as 2xs's own padding-block above, which already bottoms out below
       the space scale via a raw --lr-size-* token rather than reusing --lr-space-2xs. */
    --lr-chip-padding-inline: var(--lr-size-0-0625rem);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-3xs);
  }
  :host([size='2xs']) {
    --lr-chip-font-size: var(--lr-font-size-2xs);
    --lr-chip-padding-block: var(--lr-size-0-0625rem);
    --lr-chip-padding-inline: var(--lr-space-2xs);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-chip-font-size: var(--lr-font-size-xs);
    --lr-chip-padding-block: var(--lr-size-0-125rem);
    --lr-chip-padding-inline: var(--lr-space-xs);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-chip-font-size: var(--lr-font-size-xs);
    --lr-chip-padding-block: var(--lr-size-0-125rem);
    --lr-chip-padding-inline: var(--lr-size-0-375rem);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-xs);
  }
  :host([size='l']) {
    --lr-chip-font-size: var(--lr-font-size-m);
    --lr-chip-padding-block: var(--lr-size-0-375rem);
    --lr-chip-padding-inline: var(--lr-space-m);
    --lr-chip-gap: var(--lr-size-0-375rem);
    --lr-chip-icon-size: var(--lr-font-size-m);
    --lr-chip-min-height: var(--lr-size-1-75rem);
  }
  :host([size='xl']) {
    --lr-chip-font-size: var(--lr-font-size-lg);
    --lr-chip-padding-block: var(--lr-space-s);
    --lr-chip-padding-inline: var(--lr-space-l);
    --lr-chip-gap: var(--lr-space-s);
    --lr-chip-icon-size: var(--lr-font-size-lg);
    --lr-chip-min-height: var(--lr-size-2rem);
  }

  :host([tone='brand']) {
    --lr-chip-accent: var(--lr-color-brand);
    --lr-chip-bg: var(--lr-color-brand-quiet);
    --lr-chip-border: transparent;
  }
  :host([tone='success']) {
    --lr-chip-accent: var(--lr-color-success);
    --lr-chip-bg: var(--lr-color-success-quiet);
    --lr-chip-border: transparent;
  }
  :host([tone='warning']) {
    --lr-chip-accent: var(--lr-color-warning);
    --lr-chip-bg: var(--lr-color-warning-quiet);
    --lr-chip-border: transparent;
  }
  :host([tone='danger']) {
    --lr-chip-accent: var(--lr-color-danger);
    --lr-chip-bg: var(--lr-color-danger-quiet);
    --lr-chip-border: transparent;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-chip-gap);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-chip-padding-block) var(--lr-chip-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-chip-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-chip-bg);
    color: var(--lr-chip-accent);
    font: inherit;
    font-size: var(--lr-chip-font-size);
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-snug);
    /* Pinned only when --lr-chip-height is set; 'auto' otherwise, so a display chip keeps growing
       to fit its own content exactly as before. Applies to interactive and non-interactive chips
       alike -- the interactive floor lives on the [role='button'] rule below. */
    block-size: var(--lr-chip-height, auto);
  }

  [part='base'][role='button'] {
    cursor: pointer;
    min-block-size: var(--lr-chip-height, var(--lr-chip-min-height));
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='base'][role='button']:hover {
    background: color-mix(in srgb, var(--lr-chip-accent) 8%, var(--lr-chip-bg));
  }
  [part='base'][role='button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='base'][aria-pressed='true'] {
    /* Falls back to --lr-chip-bg (today's exact value) so every existing consumer renders
       byte-identical when unset. A consumer wanting a distinct "active" tint independent of the
       resting background sets --lr-chip-pressed-bg directly. */
    background: var(--lr-chip-pressed-bg, var(--lr-chip-bg));
    /* Falls back to --lr-chip-accent (today's exact value) so every
       existing consumer, including all 4 \`tone\` variants, renders
       byte-identical when unset. A consumer with a per-item arbitrary
       color sets --lr-chip-pressed-border directly, leaving
       --lr-chip-accent (and therefore the label text color) untouched. */
    border-color: var(--lr-chip-pressed-border, var(--lr-chip-accent));
  }

  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-chip-icon-size);
  }
  [part='icon'] ::slotted(*) {
    display: block;
  }
  /* Defeats [part='icon']'s own 'display: inline-flex' above -- the native
     [hidden] UA rule alone would lose to it at equal specificity. Same fix
     lr-stat's identical [part='icon'][hidden] override already applies. */
  [part='icon'][hidden] {
    display: none;
  }

  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-swatch-picker's [part='swatch']/lr-token-input's [part='remove']), while the
     *visible* glyph stays a compact 0.75em × close icon -- a chip is a small horizontal pill, and
     growing the whole button box to 40px would visually balloon the row. Since the button sits at
     the pill's trailing edge with nothing after it, the extra hit-target growth is pulled back via
     a matching negative margin (rather than growing outward into the next chip in a wrapped row) so
     the *visible* pill footprint is unchanged -- the enlarged hit area simply overlaps into the
     pill's own padding/background rather than expanding the row's layout box. */
  [part='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: calc((var(--lr-icon-button-size) - var(--lr-size-1-25rem)) / -2);
    margin-inline-end: calc((var(--lr-icon-button-size) - var(--lr-size-1-25rem)) / -2 + var(--lr-size-neg-0-15rem));
    padding: 0;
    border: none;
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: inherit;
    font-size: var(--lr-size-0-75em);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='remove-button']:hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  [part='remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='remove-button'] svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='remove-button'],
    [part='base'][role='button'] {
      transition: none !important;
    }
  }
`;
