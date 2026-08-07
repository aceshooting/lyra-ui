import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }

  /* The block size arrives as --lr-embedding-explorer-height, set on the host from the height
     property. An SVG height presentation attribute cannot carry it -- any stylesheet declaration
     outranks a presentation attribute -- and an inline block-size on the SVG would hide the value
     from consumers rethemeing through the custom property. The auto fallback is the
     aspect-ratio-preserved size derived from the viewBox. */
  [part='plot'] {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-embedding-explorer-height, auto);
    overflow: visible;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }

  [part='point'] {
    cursor: pointer;
    outline: none;
  }

  .point-hit {
    fill: none;
    stroke: transparent;
    stroke-width: var(--lr-size-24px);
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    pointer-events: stroke;
  }

  [part='point']:hover,
  [part='point']:focus-visible {
    outline: none;
  }

  [part='point']:hover .point-marker,
  [part='point']:focus-visible .point-marker {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-medium);
  }

  /* Pressed thickens the same ring the hover/focus rule above draws rather than retinting it: the
     ring is already --lr-color-text, which is exactly what --lr-color-mix-partner tracks, so a mix
     toward the partner would resolve back to the colour it started from. Width is the one axis left
     that reads as visibly stronger. Placed after the hover rule so it wins at equal specificity
     while the point is both hovered and held. */
  [part='point']:active .point-marker {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-thick);
  }

  [part='point'][data-selected='true'] .point-marker {
    stroke: var(--lr-embedding-explorer-selected-stroke, var(--lr-color-brand));
    stroke-width: var(--lr-border-width-medium);
  }

  [part='empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }

  /* A floor, never a fixed size: min-block-size only ever raises the resolved block-size, so a
     taller height still wins at narrow allocations. */
  @container (max-inline-size: 319.98px) {
    [part='plot'] {
      min-block-size: var(--lr-size-12rem);
    }
  }
`;
