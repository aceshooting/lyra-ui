import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
  }
  :host([shape='ring']) {
    display: inline-block;
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  :host([shape='ring']) [part='base'] {
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
    /* Quiet neutral fill for the unfilled remainder: deliberately lighter than a 'neutral'-tone
       segment (var(--lr-color-border) at full strength below), so counted-but-uncolored data
       stays visually distinct from not counted at all. */
    background: color-mix(in srgb, var(--lr-color-border) 30%, transparent);
  }
  [part='segment'] {
    display: block;
    flex: 0 0 auto;
    block-size: 100%;
    background: var(--lr-color-border);
    transition: flex-basis var(--lr-transition-base);
  }
  /* A hairline seam between adjacent segments, painted in the surface color rather than as real
     gap spacing, so two adjacent same-tone segments (e.g. two 'neutral' entries) read as separate
     quantities instead of one block. The logical property keeps it RTL-correct without extra
     math. */
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

  /* --- legend --------------------------------------------------------- */
  /* The key grows a row per consumer-supplied segment and each label grows with translation, so it
     wraps rather than overflows; min-inline-size: 0 on every item shrinks a long label inside its
     own row instead of widening the meter's allocation. Same shape and part names as
     lr-sequence-strip's legend. */
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }
  [part='legend-swatch'] {
    flex: none;
    inline-size: var(--lr-context-meter-legend-swatch-size, var(--lr-size-0-625rem));
    block-size: var(--lr-context-meter-legend-swatch-size, var(--lr-size-0-625rem));
    border-radius: var(--lr-radius-xs);
    /* The chip reproduces the option's data colour as [part='segment'] does -- same tone ladder,
       same inline custom-property escape -- so a swatch can never disagree with its band. */
    background: var(--lr-color-border);
  }
  [part='legend-swatch'][data-tone='brand'] {
    background: var(--lr-color-brand);
  }
  [part='legend-swatch'][data-tone='success'] {
    background: var(--lr-color-success);
  }
  [part='legend-swatch'][data-tone='warning'] {
    background: var(--lr-color-warning);
  }
  [part='legend-swatch'][data-tone='danger'] {
    background: var(--lr-color-danger);
  }
  [part='legend-swatch'][style*='--lr-context-meter-segment-color'] {
    background: var(--lr-context-meter-segment-color);
  }
  [part='legend-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  /* The ring is a fixed 8em square, so a legend under it would be clipped by the host's own block
     size. Only under show-legend does the host stop being square: the ring keeps its declared size
     and the key flows beneath it. */
  :host([shape='ring'][show-legend]) {
    block-size: auto;
  }
  :host([shape='ring'][show-legend]) svg[part='base'] {
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }

  /* --- ring variant -------------------------------------------------- */
  :host([shape='ring']) svg[part='base'] {
    display: block;
    overflow: visible;
  }
  :host([shape='ring']) [part='track'] {
    fill: none;
    stroke: color-mix(in srgb, var(--lr-color-border) 30%, transparent);
  }
  :host([shape='ring']) [part='segment'] {
    fill: none;
    stroke: var(--lr-color-border);
    /* Butt caps: round caps on tightly-packed segmented arcs bleed past the exact boundary and
       overlap the next segment's color. */
    stroke-linecap: butt;
    transition:
      stroke-dasharray var(--lr-transition-base),
      stroke-dashoffset var(--lr-transition-base);
  }
  :host([shape='ring']) [part='segment'][data-tone='brand'] {
    stroke: var(--lr-color-brand);
  }
  :host([shape='ring']) [part='segment'][data-tone='success'] {
    stroke: var(--lr-color-success);
  }
  :host([shape='ring']) [part='segment'][data-tone='warning'] {
    stroke: var(--lr-color-warning);
  }
  :host([shape='ring']) [part='segment'][data-tone='danger'] {
    stroke: var(--lr-color-danger);
  }
  :host([shape='ring']) [part='segment'][style*='--lr-context-meter-segment-color'] {
    stroke: var(--lr-context-meter-segment-color);
  }
  :host([shape='ring']) [part='label'] {
    overflow: hidden;
  }
  :host([shape='ring']) .ring-label {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-2xs);
    line-height: var(--lr-line-height-compact);
    text-align: center;
    text-transform: uppercase;
  }

  @media (forced-colors: active) {
    [part='segment'],
    [part='legend-swatch'] {
      forced-color-adjust: none;
      background: CanvasText;
      border: var(--lr-border-width-thin) solid Canvas;
    }
    [part='segment'][data-tone='success'],
    [part='legend-swatch'][data-tone='success'] {
      border-style: dashed;
    }
    [part='segment'][data-tone='warning'],
    [part='legend-swatch'][data-tone='warning'] {
      border-style: dotted;
    }
    [part='segment'][data-tone='danger'],
    [part='legend-swatch'][data-tone='danger'] {
      border-style: double;
    }
    :host([shape='ring']) [part='segment'] {
      fill: none;
      stroke: CanvasText;
    }
    :host([shape='ring']) [part='segment'][data-tone='success'] {
      stroke-dasharray: 8 3;
    }
    :host([shape='ring']) [part='segment'][data-tone='warning'] {
      stroke-dasharray: 2 3;
    }
    :host([shape='ring']) [part='segment'][data-tone='danger'] {
      stroke-dasharray: 8 2 2 2;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='segment'] {
      transition: none !important;
    }
  }
`;
