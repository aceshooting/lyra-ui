import { css } from "lit";

// Shares its collapsible-header shape (border/radius/hover/focus-ring, the
// rotating chevron) with lr-source-list's styles almost verbatim -- the two
// are siblings in the same "collapsible region behind a header button"
// family and are meant to sit comfortably next to each other in a message.
export const styles = css`
  :host {
    display: block;
    /* Consumer-overridable cap on how tall the reasoning transcript grows
       before it scrolls internally, e.g. via ::part(body) or by overriding
       this custom property directly -- not exposed as a component prop
       since it's a pure layout knob, not something a template branches on. */
    --_lr-thinking-panel-max-block-size: var(--lr-size-16rem);
  }
  [part="base"] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  /* Density escape for transcript rows. The values sit behind inline var() fallbacks so a
     containing transcript can retune them without redeclaring the rules, while an unset panel
     keeps the pre-existing regular dimensions. */
  :host([compact]) [part="header"] {
    padding: var(
      --lr-thinking-panel-compact-header-padding,
      var(--lr-space-2xs) var(--lr-space-s)
    );
    gap: var(--lr-thinking-panel-compact-header-gap, var(--lr-space-2xs));
  }
  :host([compact]) [part="body"] {
    padding: var(--lr-thinking-panel-compact-body-padding, var(--lr-space-s));
  }
  /* Removes only the outer card treatment. The header/body divider remains because it explains
     the expanded disclosure structure even when a surrounding message supplies the outer frame. */
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
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes rather than repeating it. */
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
  /* RTL: the resting (collapsed) chevron mirrors to point left, the
     conventional mirrored disclosure-triangle direction for RTL. Scoped to
     the collapsed state specifically (rather than a plain :dir(rtl) rule) so
     it never has to compete with the rule above for the expanded state, which
     needs no mirroring: rotating this left-right-asymmetric glyph 90deg
     already produces a left-right-symmetric down chevron. Mirrors
     lr-source-list's and lr-code-block's identical toggle chevron. */
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
  /* Actively streaming with no duration yet -- a full-opacity brand-colored
     label plus a separate decorative pulse dot, deliberately *not* animating
     the text's own opacity the way lr-typing-indicator's pulse variant
     does: that dims it well below AA contrast for part of every cycle, fine
     for a purely decorative shape but not for text carrying real content
     ("Thinking…"). */
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
    /* Reaching this region's own top/bottom edge stops there instead of
       chaining the scroll into the host page -- this is precisely the
       component that tracks and respects the reader scrolling within it, so
       it shouldn't hand that scroll off to the page underneath it. Same
       convention as virtual-list.styles.ts's own auto-scrolling region. */
    overscroll-behavior: contain;
    padding: var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-normal);
  }
  /* [part='body'] unconditionally carries tabindex="0" (a real, always-focusable, independently
     scrollable region) -- same convention as lr-code-block's [part='body'] and lr-virtual-list's
     [part='base'], both cited by name in this component's own class file. Without this rule a
     keyboard user tabbing into the reasoning transcript gets no visible indicator at all. */
  [part="body"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    /* Negative (inward) so the ring isn't clipped by this element's own
       overflow-block:auto -- same reasoning as lr-code-block's identical rule. */
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Subtler preview of the same treatment for mouse users, who otherwise get no cue that this is a
     separately scrollable/focusable region. A plain border color, not the focus ring's brand color,
     so the eventual :focus-visible ring stays visually distinct -- matching lr-virtual-list. */
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
