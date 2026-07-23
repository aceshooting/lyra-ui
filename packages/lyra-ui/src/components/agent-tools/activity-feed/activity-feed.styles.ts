import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-activity-feed-max-height: var(--lr-size-16rem);
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
  [part='header']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='header']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='toggle'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lr-transition-fast);
  }
  :host([expanded]) [part='toggle'] {
    transform: rotate(90deg);
  }
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='status-dot'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-text-quiet);
  }
  :host([mode='live']) [part='status-dot'] {
    background: var(--lr-color-brand);
    animation: lr-activity-feed-pulse var(--lr-transition-ambient) infinite;
  }
  [part='label'] {
    flex: 0 0 auto;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='summary'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }
  [part='body'] {
    display: flex;
    flex-direction: column;
    max-block-size: var(--lr-activity-feed-max-height);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='body'][hidden] {
    display: none;
  }
  lr-virtual-list {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-activity-feed-max-height);
  }
  /* Every entry rule below is paired with an lr-virtual-list::part(x) twin because this component
     renders entries through two paths. Below virtualize-threshold, entryTemplate()'s result is
     committed into this component's own shadow root and the plain [part=] selector matches. At or
     above it, the exact same template becomes <lr-virtual-list>'s .renderItem, and Lit commits it
     wherever virtual-list's own render() is updating -- i.e. inside *its* shadow root, a different
     shadow tree that a [part=] selector scoped to this one can never reach. ::part() crosses that
     single boundary. Both selectors are load-bearing; dropping either silently unstyles one path. */
  [part='entry'],
  lr-virtual-list::part(entry) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-2xs) var(--lr-space-m);
  }
  [part='entry-icon'],
  lr-virtual-list::part(entry-icon) {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    inline-size: var(--lr-size-1em);
  }
  [part~='tone-dot'],
  lr-virtual-list::part(tone-dot) {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
  }
  /* Shadow Parts forbids an attribute selector after ::part(), so the tone cannot be matched as
     ::part(tone-dot)[data-tone='success'] -- that selector is invalid and would drop the rule
     entirely. Each tone carries a second name in the dot's part list instead; ::part() matches
     with part~= semantics, so both names select the same element, and a consumer gains a
     per-tone hook the [data-tone] form never offered. The [part~=] form is the plain-path twin:
     [part='tone-dot-success'] would not match a multi-name part attribute. */
  [part~='tone-dot-neutral'],
  lr-virtual-list::part(tone-dot-neutral) {
    background: var(--lr-color-text-quiet);
  }
  [part~='tone-dot-brand'],
  lr-virtual-list::part(tone-dot-brand) {
    background: var(--lr-color-brand);
  }
  [part~='tone-dot-success'],
  lr-virtual-list::part(tone-dot-success) {
    background: var(--lr-color-success);
  }
  [part~='tone-dot-warning'],
  lr-virtual-list::part(tone-dot-warning) {
    background: var(--lr-color-warning);
  }
  [part~='tone-dot-danger'],
  lr-virtual-list::part(tone-dot-danger) {
    background: var(--lr-color-danger);
  }
  [part='entry-text'],
  lr-virtual-list::part(entry-text) {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-3ch);
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
  }
  [part='entry-timestamp'],
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
    [part='toggle'] {
      transition: none !important;
    }
    [part='status-dot'] {
      animation: none !important;
    }
  }
`;
