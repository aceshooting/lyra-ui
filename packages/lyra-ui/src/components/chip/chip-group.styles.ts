import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  /* Deliberately its own local pill styling rather than instantiating a
     real <lyra-chip> in the shadow DOM for this -- keeps the group's
     rendering self-contained instead of depending on chip.ts's internal
     shape, the same way this family's overlay-shaped components duplicate
     rather than nest one another. */
  [part='overflow-indicator'] {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0.25rem var(--lyra-space-s);
    border: 1px dashed var(--lyra-color-border);
    border-radius: 999px;
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text-quiet);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.3;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast),
      color var(--lyra-transition-fast);
  }
  /* Dashed border marks it as a structural "more" affordance, distinct at a
     glance from the solid-bordered real chips it sits alongside. */
  [part='overflow-indicator']:hover {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-text);
  }
  [part='overflow-indicator']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='overflow-indicator'][aria-expanded='true'] {
    border-style: solid;
    color: var(--lyra-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-indicator'] {
      transition: none !important;
    }
  }
`;
