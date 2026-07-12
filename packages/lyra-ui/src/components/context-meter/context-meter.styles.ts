import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
  }
  :host([variant='ring']) {
    display: inline-block;
    inline-size: 8em;
    block-size: 8em;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  :host([variant='ring']) [part='base'] {
    inline-size: 100%;
    block-size: 100%;
  }

  [part='label'] {
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
    font-family: var(--lyra-font);
  }

  /* --- bar variant ------------------------------------------------- */
  [part='track'] {
    position: relative;
    display: flex;
    align-items: stretch;
    overflow: hidden;
    block-size: 0.5rem;
    border-radius: calc(var(--lyra-radius) * 0.5);
    /* Quiet neutral fill for the unfilled remainder -- deliberately lighter
       than a 'neutral'-tone segment (var(--lyra-color-border) at full
       strength below) so "counted but uncolored" data still reads as
       visually distinct from "not counted at all". */
    background: color-mix(in srgb, var(--lyra-color-border) 30%, transparent);
  }
  [part='segment'] {
    display: block;
    flex: 0 0 auto;
    block-size: 100%;
    background: var(--lyra-color-border);
    transition: flex-basis var(--lyra-transition-base);
  }
  /* A hairline seam between adjacent segments -- painted in the surface
     color rather than as real gap spacing, so two same-tone segments next
     to each other (e.g. two 'neutral' entries) still read as separate
     quantities instead of merging into one block. Logical property keeps it
     RTL-correct without extra math. */
  [part='segment']:not(:first-of-type) {
    border-inline-start: 1px solid var(--lyra-color-surface);
  }
  [part='segment'][data-tone='brand'] {
    background: var(--lyra-color-brand);
  }
  [part='segment'][data-tone='success'] {
    background: var(--lyra-color-success);
  }
  [part='segment'][data-tone='warning'] {
    background: var(--lyra-color-warning);
  }
  [part='segment'][data-tone='danger'] {
    background: var(--lyra-color-danger);
  }
  [part='segment'][data-tone='neutral'] {
    background: var(--lyra-color-border);
  }

  /* --- ring variant -------------------------------------------------- */
  :host([variant='ring']) svg[part='base'] {
    display: block;
    overflow: visible;
  }
  :host([variant='ring']) [part='track'] {
    fill: none;
    stroke: color-mix(in srgb, var(--lyra-color-border) 30%, transparent);
  }
  :host([variant='ring']) [part='segment'] {
    fill: none;
    stroke: var(--lyra-color-border);
    /* Butt (not round) caps -- round caps on tightly-packed segmented arcs
       bleed past the exact boundary and overlap the next segment's color. */
    stroke-linecap: butt;
    transition:
      stroke-dasharray var(--lyra-transition-base),
      stroke-dashoffset var(--lyra-transition-base);
  }
  :host([variant='ring']) [part='segment'][data-tone='brand'] {
    stroke: var(--lyra-color-brand);
  }
  :host([variant='ring']) [part='segment'][data-tone='success'] {
    stroke: var(--lyra-color-success);
  }
  :host([variant='ring']) [part='segment'][data-tone='warning'] {
    stroke: var(--lyra-color-warning);
  }
  :host([variant='ring']) [part='segment'][data-tone='danger'] {
    stroke: var(--lyra-color-danger);
  }
  :host([variant='ring']) [part='segment'][data-tone='neutral'] {
    stroke: var(--lyra-color-border);
  }
  :host([variant='ring']) [part='label'] {
    text-anchor: middle;
    fill: var(--lyra-color-text-quiet);
    font-size: 0.625rem;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='segment'] {
      transition: none !important;
    }
  }
`;
