import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  /* Local pill styling rather than a real <lr-chip> in the shadow DOM: keeps the group
     self-contained instead of depending on chip.ts's internal shape, the way this family's
     overlay-shaped components duplicate rather than nest one another. */
  [part='overflow-indicator'] {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    justify-content: center;
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) dashed var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast),
      color var(--lr-transition-fast);
  }
  /* Dashed border marks a structural more affordance, distinct at a glance from the
     solid-bordered real chips beside it. */
  [part='overflow-indicator']:hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-text);
  }
  /* Pressed adds the fill hover leaves alone, a step further in rather than a restatement. The
     surface mixes toward --lr-color-mix-partner, which follows the text colour, so the tint
     darkens on light themes and lightens on dark. Border and text are restated, not inherited,
     because keyboard activation (Space/Enter on the focused indicator) raises :active with no
     :hover. */
  [part='overflow-indicator']:active {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-text);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='overflow-indicator']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The :where() zeroes the [aria-expanded='true'] qualifier, holding this at (0,1,0) -- below
     the (0,2,0) :hover and :active rules above, so pointer feedback still reads while the picker
     is open. Colour and border style route through scoped cssprops, as lr-widget's
     [aria-pressed='true'] does, so a consumer can retint or reshape the expanded state alone. */
  [part='overflow-indicator']:where([aria-expanded='true']) {
    border-style: var(--lr-chip-group-overflow-expanded-border-style, solid);
    color: var(--lr-chip-group-overflow-expanded-color, var(--lr-color-text));
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-indicator'] {
      transition: none !important;
    }
  }
`;
