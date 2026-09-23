import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  /* Density escape -- same convention as this list's own slotted lr-source-card children's
     compact. Values sit behind inline var() fallbacks, not :host declarations that every instance
     re-declares and so shadows any ancestor value, so a transcript can retune every embedded panel
     at once; the fallbacks are the pre-existing values, so an unset panel renders unchanged. */
  :host([compact]) [part='header'] {
    padding: var(--lr-source-list-compact-header-padding, var(--lr-space-2xs) var(--lr-space-s));
    gap: var(--lr-source-list-compact-header-gap, var(--lr-space-2xs));
  }
  :host([compact]) [part='list'] {
    gap: var(--lr-source-list-compact-gap, var(--lr-space-2xs));
    padding: var(--lr-source-list-compact-list-padding, var(--lr-space-s));
  }
  /* Chrome escape -- same convention as lr-thinking-panel's/lr-task-list's frame="plain": drops
     the outer border/background/radius so a panel nested in a container that already draws a
     border (a message bubble) doesn't double it. The header/list divider is layout, not outer
     chrome, so it stays. */
  :host([frame='plain']) [part='base'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
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
    transition: var(--lr-transition-interactive);
  }
  [part='header']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='header']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
  /* RTL: the resting (collapsed) chevron mirrors to point left, the conventional mirrored
     disclosure-triangle direction for RTL. Scoped to the collapsed state rather than a plain
     :dir(rtl) rule so it never competes with the rule above: the expanded state needs no mirroring,
     because rotating this left-right-asymmetric glyph 90deg already produces a left-right-symmetric
     down chevron. Mirrors lr-code-block's identical toggle chevron. */
  :host(:not([expanded]):dir(rtl)) [part='toggle'] {
    transform: scaleX(-1);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    padding: 0 var(--lr-space-m) var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding-block-start: var(--lr-space-m);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='list'][hidden] {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toggle'] {
      transition: none !important;
    }
  }
`;
