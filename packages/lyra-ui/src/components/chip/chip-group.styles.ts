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
  [part='overflow-indicator']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='overflow-indicator'][aria-expanded='true'] {
    border-style: solid;
    color: var(--lr-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-indicator'] {
      transition: none !important;
    }
  }
`;
