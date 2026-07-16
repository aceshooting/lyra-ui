import { css } from 'lit';

// Shares its collapsible-header shape (border/radius/hover/focus-ring, the
// rotating chevron) with lyra-source-list's styles almost verbatim -- the two
// are siblings in the same "collapsible region behind a header button"
// family and are meant to sit comfortably next to each other in a message.
export const styles = css`
  :host {
    display: block;
    /* Consumer-overridable cap on how tall the reasoning transcript grows
       before it scrolls internally, e.g. via ::part(body) or by overriding
       this custom property directly -- not exposed as a component prop
       since it's a pure layout knob, not something a template branches on. */
    --lyra-thinking-panel-max-block-size: var(--lyra-size-16rem);
  }
  [part='base'] {
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: none;
    background: none;
    color: var(--lyra-color-text);
    font: inherit;
    font-weight: var(--lyra-font-weight-semibold);
    font-size: var(--lyra-font-size-md-sm);
    text-align: start;
    cursor: pointer;
  }
  [part='header']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lyra-transition-fast);
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  /* RTL: the resting (collapsed) chevron mirrors to point left, the
     conventional mirrored disclosure-triangle direction for RTL. Scoped to
     the collapsed state specifically (rather than a plain :dir(rtl) rule) so
     it never has to compete with the rule above for the expanded state, which
     needs no mirroring: rotating this left-right-asymmetric glyph 90deg
     already produces a left-right-symmetric down chevron. Mirrors
     lyra-source-list's and lyra-code-block's identical toggle chevron. */
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='duration'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-size-0-35em);
    flex: 0 0 auto;
    font-weight: var(--lyra-font-weight-normal);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  /* Actively streaming with no duration yet -- a full-opacity brand-colored
     label plus a separate decorative pulse dot, deliberately *not* animating
     the text's own opacity the way lyra-typing-indicator's pulse variant
     does: that dims it well below AA contrast for part of every cycle, fine
     for a purely decorative shape but not for text carrying real content
     ("Thinking…"). */
  [part='duration'][data-pending] {
    color: var(--lyra-color-brand);
  }
  .pending-dot {
    inline-size: var(--lyra-size-0-375rem);
    block-size: var(--lyra-size-0-375rem);
    border-radius: 50%;
    background: currentColor;
    animation: lyra-thinking-panel-pulse var(--lyra-transition-ambient) infinite;
  }
  @keyframes lyra-thinking-panel-pulse {
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
  [part='body'] {
    max-block-size: var(--lyra-thinking-panel-max-block-size);
    overflow-y: auto;
    /* Reaching this region's own top/bottom edge stops there instead of
       chaining the scroll into the host page -- this is precisely the
       component that tracks and respects the reader scrolling within it, so
       it shouldn't hand that scroll off to the page underneath it. Same
       convention as virtual-list.styles.ts's own auto-scrolling region. */
    overscroll-behavior: contain;
    padding: var(--lyra-space-m);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
    line-height: var(--lyra-line-height-normal);
  }
  [part='body'][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] {
      transition: none !important;
    }
    .pending-dot {
      animation: none !important;
      opacity: 1;
      transform: none;
    }
  }
`;
