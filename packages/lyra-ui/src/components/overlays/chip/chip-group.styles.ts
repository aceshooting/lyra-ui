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
  /* Deliberately its own local pill styling rather than instantiating a
     real <lr-chip> in the shadow DOM for this -- keeps the group's
     rendering self-contained instead of depending on chip.ts's internal
     shape, the same way this family's overlay-shaped components duplicate
     rather than nest one another. */
  [part='overflow-indicator'] {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
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
  /* Dashed border marks it as a structural "more" affordance, distinct at a
     glance from the solid-bordered real chips it sits alongside. */
  [part='overflow-indicator']:hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-text);
  }
  /* Pressed adds what the hover deliberately leaves alone -- a fill -- so the press is a visible
     step further in, not a restatement. The surface is mixed toward --lr-color-mix-partner (which
     follows the text colour), so the tint darkens on a light theme and lightens on a dark one
     without this rule knowing which is in force. The border and text treatments are restated
     rather than inherited from the hover rule because keyboard activation (Space/Enter on the
     focused indicator) raises :active with no :hover at all. */
  [part='overflow-indicator']:active {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-text);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='overflow-indicator']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :where() zeroes the [aria-expanded='true'] qualifier's specificity contribution -- otherwise
     this (0,2,0) rule would beat a consumer's own ::part(overflow-indicator) color override
     whenever the picker is open. color routes through a scoped cssprop (mirroring lr-widget's
     [aria-pressed='true'] treatment) so a consumer can retint just the expanded state without
     hijacking the shared --lr-color-text token used everywhere else. */
  [part='overflow-indicator']:where([aria-expanded='true']) {
    border-style: solid;
    color: var(--lr-chip-group-overflow-expanded-color, var(--lr-color-text));
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-indicator'] {
      transition: none !important;
    }
  }
`;
