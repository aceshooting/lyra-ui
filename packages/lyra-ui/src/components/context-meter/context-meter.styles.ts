import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
  }
  :host([variant='ring']) {
    display: inline-block;
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  :host([variant='ring']) [part='base'] {
    inline-size: 100%;
    block-size: 100%;
  }

  [part='label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font);
  }

  /* --- bar variant ------------------------------------------------- */
  [part='track'] {
    position: relative;
    display: flex;
    align-items: stretch;
    overflow: hidden;
    block-size: var(--lr-size-0-5rem);
    border-radius: calc(var(--lr-radius) * 0.5);
    /* Quiet neutral fill for the unfilled remainder -- deliberately lighter
       than a 'neutral'-tone segment (var(--lr-color-border) at full
       strength below) so "counted but uncolored" data still reads as
       visually distinct from "not counted at all". */
    background: color-mix(in srgb, var(--lr-color-border) 30%, transparent);
  }
  [part='segment'] {
    display: block;
    flex: 0 0 auto;
    block-size: 100%;
    background: var(--lr-color-border);
    transition: flex-basis var(--lr-transition-base);
  }
  /* A hairline seam between adjacent segments -- painted in the surface
     color rather than as real gap spacing, so two same-tone segments next
     to each other (e.g. two 'neutral' entries) still read as separate
     quantities instead of merging into one block. Logical property keeps it
     RTL-correct without extra math. */
  [part='segment']:not(:first-of-type) {
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-surface);
  }
  [part='segment'][data-tone='brand'] {
    background: var(--lr-color-brand);
  }
  [part='segment'][data-tone='success'] {
    background: var(--lr-color-success);
  }
  [part='segment'][data-tone='warning'] {
    background: var(--lr-color-warning);
  }
  [part='segment'][data-tone='danger'] {
    background: var(--lr-color-danger);
  }
  [part='segment'][style*='--lr-context-meter-segment-color'] {
    background: var(--lr-context-meter-segment-color);
  }

  /* --- ring variant -------------------------------------------------- */
  :host([variant='ring']) svg[part='base'] {
    display: block;
    overflow: visible;
  }
  :host([variant='ring']) [part='track'] {
    fill: none;
    stroke: color-mix(in srgb, var(--lr-color-border) 30%, transparent);
  }
  :host([variant='ring']) [part='segment'] {
    fill: none;
    stroke: var(--lr-color-border);
    /* Butt (not round) caps -- round caps on tightly-packed segmented arcs
       bleed past the exact boundary and overlap the next segment's color. */
    stroke-linecap: butt;
    transition:
      stroke-dasharray var(--lr-transition-base),
      stroke-dashoffset var(--lr-transition-base);
  }
  :host([variant='ring']) [part='segment'][data-tone='brand'] {
    stroke: var(--lr-color-brand);
  }
  :host([variant='ring']) [part='segment'][data-tone='success'] {
    stroke: var(--lr-color-success);
  }
  :host([variant='ring']) [part='segment'][data-tone='warning'] {
    stroke: var(--lr-color-warning);
  }
  :host([variant='ring']) [part='segment'][data-tone='danger'] {
    stroke: var(--lr-color-danger);
  }
  :host([variant='ring']) [part='segment'][style*='--lr-context-meter-segment-color'] {
    stroke: var(--lr-context-meter-segment-color);
  }
  :host([variant='ring']) [part='label'] {
    text-anchor: middle;
    fill: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-2xs);
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='segment'] {
      transition: none !important;
    }
  }
`;
