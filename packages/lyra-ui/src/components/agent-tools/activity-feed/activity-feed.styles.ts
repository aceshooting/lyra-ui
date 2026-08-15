import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-activity-feed-max-height: var(--lr-size-16rem);
  }
  [part="base"] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part="header"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: none;
    background: none;
    color: var(--lr-color-text);
    font: inherit;
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
  :host(:not([expanded]):dir(rtl)) [part="toggle"] {
    transform: scaleX(-1);
  }
  [part="status-dot"] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-text-quiet);
  }
  :host([mode="live"]) [part="status-dot"] {
    background: var(
      --lr-activity-feed-live-status-color,
      var(--lr-color-brand)
    );
    animation: lr-activity-feed-pulse var(--lr-transition-ambient) infinite;
  }
  [part="label"] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="summary"] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-3ch);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }
  [part="body"] {
    display: flex;
    flex-direction: column;
    max-block-size: var(
      --lr-activity-feed-max-height,
      var(--_lr-activity-feed-max-height)
    );
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="body"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part="body"][hidden] {
    display: none;
  }
  lr-virtual-list {
    display: block;
    inline-size: 100%;
    block-size: var(
      --lr-activity-feed-max-height,
      var(--_lr-activity-feed-max-height)
    );
  }
  /* Every entry rule below is paired with an lr-virtual-list::part(x) twin because this component
     renders entries through two paths. Below virtualize-at, entryTemplate()'s result is
     committed into this component's own shadow root and the plain [part=] selector matches. At or
     above it, the exact same template becomes <lr-virtual-list>'s .renderItem, and Lit commits it
     wherever virtual-list's own render() is updating -- i.e. inside *its* shadow root, a different
     shadow tree that a [part=] selector scoped to this one can never reach. ::part() crosses that
     single boundary. Both selectors are load-bearing; dropping either silently unstyles one path. */
  [part="entry"],
  lr-virtual-list::part(entry) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-2xs) var(--lr-space-m);
  }
  [part="entry-icon"],
  lr-virtual-list::part(entry-icon) {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    inline-size: var(--lr-size-1em);
  }
  [part~="variant-dot"],
  lr-virtual-list::part(variant-dot) {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
  }
  /* Shadow Parts forbids an attribute selector after ::part(), so the variant cannot be matched as
     ::part(variant-dot)[data-variant='success'] -- that selector is invalid and would drop the rule
     entirely. Each variant carries a second name in the dot's part list instead; ::part() matches
     with part~= semantics, so both names select the same element, and a consumer gains a
     per-variant hook the [data-variant] form never offered. The [part~=] form is the plain-path
     twin: [part='variant-dot-success'] would not match a multi-name part attribute. */
  [part~="variant-dot-neutral"],
  lr-virtual-list::part(variant-dot-neutral) {
    background: var(--lr-color-text-quiet);
  }
  [part~="variant-dot-brand"],
  lr-virtual-list::part(variant-dot-brand) {
    background: var(--lr-color-brand);
  }
  [part~="variant-dot-success"],
  lr-virtual-list::part(variant-dot-success) {
    background: var(--lr-color-success);
  }
  [part~="variant-dot-warning"],
  lr-virtual-list::part(variant-dot-warning) {
    background: var(--lr-color-warning);
  }
  [part~="variant-dot-danger"],
  lr-virtual-list::part(variant-dot-danger) {
    background: var(--lr-color-danger);
  }
  [part="entry-text"],
  lr-virtual-list::part(entry-text) {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-3ch);
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
  }
  [part="entry-timestamp"],
  lr-virtual-list::part(entry-timestamp) {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  @keyframes lr-activity-feed-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part="toggle"] {
      transition: none !important;
    }
    [part="status-dot"] {
      animation: none !important;
    }
  }
`;
