import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-1-4);
  }

  /* Plain layout wrapper, no ARIA role: [part='select-button'] alone is the interactive/selectable
     region, kept free of focusable descendants (class doc's nested-interactive note). Row-level
     hover/active backgrounds live here so hovering anywhere -- rename/actions controls included --
     highlights the whole row. */
  [part='base'] {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-radius: var(--lr-radius);
    transition: background-color var(--lr-transition-fast);
  }
  [part='active-indicator'] {
    position: absolute;
    inset-block: 0;
    inset-inline: var(--lr-conversation-item-active-indicator-inset-inline, 0 auto);
    inline-size: var(--lr-conversation-item-active-indicator-width, var(--lr-size-2px));
    box-sizing: border-box;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-conversation-item-active-indicator-color, var(--lr-color-brand));
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  /* Density escape -- same convention as lr-empty's compact. Tuned values sit in inline var()
     fallbacks, not a :host declaration (re-declared per instance, shadowing ancestor values), so a
     sidebar list retunes every row from outside; each fallback is the prior value one step down, so
     an unset row is unchanged. MUST precede the :host([active]) rules below -- equal specificity,
     so source order alone decides any declaration they share, and active is the stronger appearance
     statement.

     compact deliberately skips [part='rename-button']'s min-inline-size/min-block-size (the shared
     --lr-icon-button-size target floor -- lower that token at an ancestor instead),
     [part='start']'s min sizes, and the excerpt/timestamp font sizes (already the smallest steps
     here; retune via the host's inherited font-size). The excerpt stays visible too: single-line
     ellipsised and ?hidden-bindable per row, it costs one line, and hiding it is a consumer
     decision. */
  :host([compact]) [part='base'] {
    padding: var(--lr-conversation-item-compact-padding, var(--lr-space-xs) var(--lr-space-s));
    gap: var(--lr-conversation-item-compact-gap, var(--lr-space-2xs));
  }
  :host(:hover) [part='base'] {
    background: color-mix(in srgb, var(--lr-color-text) 6%, transparent);
  }
  /* Pressed. :host(:active) is the transient pointer/keyboard press; :host([active]) below is 'this
     is the open session'. The press tint is the hover tint escalated to --lr-color-mix-active
     toward --lr-color-mix-partner (which tracks the text color), so it moves the right way on light
     and dark surfaces alike. :active propagates up from the pressed [part='select-button'], so this
     plain wrapper div answers a press the way it answers hover. */
  :host(:active) [part='base'] {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  /* Both rules above are (0,3,0), like this one, so being written last hands this rule BOTH
     contests: an active-and-hovered row keeps the stronger active tint instead of two backgrounds
     competing. Right for hover, wrong for press -- hence the rule below. */
  :host([active]) [part='base'] {
    background: var(--lr-conversation-item-active-bg, var(--lr-color-brand-quiet));
  }
  /* The open session's own held state: without it the already-open row answers a click with
     nothing, because the rule above declares the same background the generic :host(:active) rule
     does and out-ranks it on source order. Hover is droppable once a row is visibly open; a press
     ('your click landed') is not. (0,4,0) via the extra :active inside :host(), so it settles
     against the [active] rule on specificity, not ordering. The mix starts from
     --lr-conversation-item-active-bg rather than transparent, so retinting the active row deepens
     THAT colour, not the stock one. */
  :host([active]:active) [part='base'] {
    background: color-mix(
      in oklab,
      var(--lr-conversation-item-active-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  /* text-quiet on brand-quiet is ~4.25:1, under the WCAG AA 4.5:1 floor for normal-size text,
     though it passes against the plain non-active background. Same fix as lr-attachment-chip's
     [part='size'] and lr-chat-message's [part='footer']: full-strength text color once active. */
  :host([active]) [part='excerpt'],
  :host([active]) [part='timestamp'] {
    color: var(--lr-conversation-item-active-color, var(--lr-color-text));
  }

  [part='select-button'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-s);
    flex: 1 1 auto;
    min-inline-size: 0;
    cursor: pointer;
    outline: none; /* the visible ring below targets [part='select-button'] directly */
    -webkit-tap-highlight-color: transparent;
  }
  [part='start'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
  }
  [part='start'][hidden] {
    display: none;
  }
  [part='select-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-0-125rem);
  }
  /* The label/excerpt/meta column's inter-row gap collapses entirely: the three lines carry their
     own line-height, so the hairline goes first. No var() hatch -- no smaller step to retune to. */
  :host([compact]) [part='content'] {
    gap: 0;
  }

  [part='label'] {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }

  [part='label-input'] {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
    border-radius: calc(var(--lr-radius) * 0.6);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='label-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='excerpt'] {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  /* The author-origin display: block above beats the UA stylesheet's [hidden] { display: none }
     regardless of specificity, so without this the ?hidden binding is a visual no-op. Same as
     [part='actions'][hidden] below and lr-timeline-item's [part='timestamp'][hidden] and
     [part='description'][hidden]. [part='meta'] declares no display, so UA [hidden] handling
     applies. */
  [part='excerpt'][hidden] {
    display: none;
  }

  [part='timestamp'] {
    flex: 0 0 auto;
    align-self: flex-start;
    white-space: nowrap;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-variant-numeric: tabular-nums;
  }

  /* A row has real room (unlike a compact chip pill), so the rename button takes the full shared
     --lr-icon-button-size floor directly -- no capped/split-glyph compromise. */
  [part='rename-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: calc(var(--lr-radius) * 0.6);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='rename-button']:hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
    color: var(--lr-color-text);
  }
  [part='rename-button']:active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
    color: var(--lr-color-text);
  }
  [part='rename-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='rename-button'] svg {
    display: block;
  }

  [part='actions'] {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='base'],
    [part='rename-button'] {
      transition: none !important;
    }
  }
`;
