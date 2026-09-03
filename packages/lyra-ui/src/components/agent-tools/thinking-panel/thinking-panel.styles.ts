import { css } from 'lit';

// Shares its collapsible-header shape (border/radius/hover/focus-ring, the
// rotating chevron) with lr-source-list's styles almost verbatim -- the two
// are siblings in the same "collapsible region behind a header button"
// family and are meant to sit comfortably next to each other in a message.
export const styles = css`
  :host {
    display: block;
    /* Consumer-overridable cap on transcript height before it scrolls internally (::part(body) or
       this property). Not a component prop: a pure layout knob nothing branches on. */
    --_lr-thinking-panel-max-block-size: var(--lr-size-16rem);
  }
  [part="base"] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  /* Density escape for transcript rows. Inline var() fallbacks let a containing transcript retune
     them without redeclaring the rules; an unset panel keeps the regular dimensions. */
  :host([compact]) [part="header"] {
    padding: var(
      --lr-thinking-panel-compact-header-padding,
      var(--lr-space-2xs) var(--lr-space-s)
    );
    gap: var(--lr-thinking-panel-compact-header-gap, var(--lr-space-2xs));
    font-size: var(
      --lr-thinking-panel-compact-header-font-size,
      var(--lr-font-size-sm)
    );
  }
  :host([compact]) [part="body"] {
    padding: var(--lr-thinking-panel-compact-body-padding, var(--lr-space-s));
  }
  /* Removes only the outer card. The header/body divider stays: it explains the expanded
     disclosure structure even when a surrounding message supplies the frame. */
  :host([frame="plain"]) [part="base"] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part="header"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: none;
    background: none;
    color: var(--lr-color-text);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-md-sm);
    text-align: start;
    cursor: pointer;
  }
  [part="header"]:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* The hovered tint pushed a further --lr-color-mix-active toward --lr-color-mix-partner (which
     follows the text colour), so the press reads deeper than hover in light and dark alike. */
  [part="header"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="header"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part="toggle"] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lr-transition-fast);
  }
  :host([expanded]) [part="toggle"] {
    transform: rotate(90deg);
  }
  /* RTL: the collapsed chevron mirrors to point left, the conventional disclosure direction.
     Scoped to the collapsed state, not a plain :dir(rtl) rule, so it never competes with the
     expanded rule above -- rotating this asymmetric glyph 90deg already yields a symmetric down
     chevron. Matches lr-source-list's and lr-code-block's toggle. */
  :host(:not([expanded]):dir(rtl)) [part="toggle"] {
    transform: scaleX(-1);
  }
  [part="label"] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-6ch);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="duration"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-0-35em);
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    text-align: end;
    font-weight: var(--lr-font-weight-normal);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* Streaming with no duration yet: a full-opacity brand label plus a separate decorative pulse
     dot. The text's opacity is deliberately NOT animated as lr-typing-indicator's pulse variant is
     -- that drops it below AA contrast for part of every cycle, fine for a decorative shape but
     not for text carrying real content. */
  [part="duration"][data-pending] {
    color: var(--lr-thinking-panel-pending-color, var(--lr-color-brand));
  }
  .pending-dot {
    inline-size: var(--lr-size-0-375rem);
    block-size: var(--lr-size-0-375rem);
    border-radius: 50%;
    background: currentColor;
    animation: lr-thinking-panel-pulse var(--lr-transition-ambient) infinite;
  }
  @keyframes lr-thinking-panel-pulse {
    0%,
    100% {
      opacity: 0.4;
      transform: scale(0.85);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }
  [part="body"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    max-block-size: var(
      --lr-thinking-panel-max-block-size,
      var(--_lr-thinking-panel-max-block-size)
    );
    overflow-inline: hidden;
    overflow-block: auto;
    overflow-wrap: anywhere;
    /* Hitting this region's edge stops there instead of chaining the scroll into the page -- the
       component tracks the reader's scroll within it, so it must not hand it off. Same convention
       as virtual-list.styles.ts's auto-scrolling region. */
    overscroll-behavior: contain;
    padding: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
  }
  /* [part='body'] always carries tabindex='0' -- an always-focusable, independently scrollable
     region, as in lr-code-block's [part='body'] and lr-virtual-list's [part='base']. Without this
     rule a keyboard user tabbing into the transcript gets no visible indicator. */
  [part="body"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    /* Inward so the ring isn't clipped by this element's overflow-block:auto, as lr-code-block. */
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* A subtler preview for mouse users, who otherwise get no cue this is a separately
     scrollable/focusable region. Plain border color, not the focus ring's brand, so the eventual
     :focus-visible ring stays distinct -- matching lr-virtual-list. */
  /* no-pressed-state: this is a scroll port, not an activation target -- pressing it activates
     nothing, and :active would match on any press landing inside the transcript text. */
  [part="body"]:hover:not(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-color-border);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part="body"][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="toggle"] {
      transition: none !important;
    }
    .pending-dot {
      animation: none !important;
      opacity: 1;
      transform: none;
    }
  }
`;
