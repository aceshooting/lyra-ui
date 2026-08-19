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
     property. An SVG height presentation attribute cannot carry it (any stylesheet declaration
     outranks a presentation attribute), and an inline block-size on the SVG would hide the value
     from consumers rethemeing through the custom property. The auto fallback is the viewBox's
     aspect-ratio-preserved size. */
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

  /* Pressed thickens the ring the hover/focus rule above draws rather than retinting it: that ring
     is already --lr-color-text, exactly what --lr-color-mix-partner tracks, so a mix toward the
     partner resolves back to its starting colour, leaving width as the one axis that reads
     stronger. Placed after the hover rule so it wins at equal specificity while a point is hovered
     and held -- UNSELECTED points only; a selected one is out-ranked by the rule below and
     escalates after it. */
  [part='point']:active .point-marker {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-thick);
  }

  [part='point'][data-selected='true'] .point-marker {
    stroke: var(--lr-embedding-explorer-selected-stroke, var(--lr-color-brand));
    stroke-width: var(--lr-border-width-medium);
  }

  /* A selected point's own pointer/focus escalation, needed because the three rules above are all
     (0,3,0), exactly like the selected rule, which is written last and so won both contests: a
     selected point acknowledged neither a press nor a focus. The focus half is an accessibility
     defect -- [part='point'] and the :hover/:focus-visible rule both declare outline: none, so this
     marker stroke IS the whole focus indicator. The escalation stays in the WIDTH channel, leaving
     the selected stroke colour alone so the point still reads as selected; --lr-focus-ring-color
     would be no help, resolving by default to --lr-color-brand -- the colour the selected ring
     already uses. The press step is one thin hair above thick because the ramp stops at thick, in
     tokens rather than a literal so a retuned scale carries it. */
  [part='point'][data-selected='true']:hover .point-marker,
  [part='point'][data-selected='true']:focus-visible .point-marker {
    stroke-width: var(--lr-border-width-thick);
  }
  [part='point'][data-selected='true']:active .point-marker {
    stroke-width: calc(var(--lr-border-width-thick) + var(--lr-border-width-thin));
  }

  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    align-items: center;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
  }

  [part='legend-swatch'] {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-xs);
    flex: none;
  }

  [part='legend-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
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
