import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-size-24rem);
    /* Choropleth fill-layer opacity -- a data-driven literal (not a color or
       geometry constant), so it's exposed as a retheme-able custom property
       instead of being hardcoded into the maplibre-gl paint expression built
       in map.class.ts. */
    --lr-map-choropleth-fill-opacity: 0.75;
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: 100%;
  }
  [part='container'] {
    position: absolute;
    inset: 0;
  }
  [part='legend'] {
    position: absolute;
    inset-block-end: var(--lr-space-s);
    inset-inline-start: var(--lr-space-s);
    z-index: var(--lr-layer-content);
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    font-size: var(--lr-font-size-xs);
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-size-2px);
    flex: 0 0 auto;
  }
`;
