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
  /* Mirrors docx-viewer.styles.ts's identical [part='error'] treatment for the same "optional
     peer dependency missing" failure shape. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
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

  /* maplibre-gl injects its attribution/logo controls INTO [part='container'], i.e. into this
     shadow root -- which the consumer's document-level \`maplibre-gl.css\` (the import map-loader.ts
     tells them to add) can never reach across the shadow boundary. Without it the attribution
     control is an unstyled <details>/<summary>: the corner anchors have no positioning so the
     attribution flows in-line BELOW the canvas, and the <summary> shows the browser's default
     disclosure triangle (a stray "▼"). Porting the essential positioning + summary reset here --
     the same approach pdf-viewer.styles.ts uses for pdf.js's textLayer CSS -- anchors the
     attribution to the map corner as an overlay and removes the marker. Only the attribution/
     container rules are ported (this wrapper exposes no zoom/geolocate/etc. controls). */
  .maplibregl-ctrl-top-left,
  .maplibregl-ctrl-top-right,
  .maplibregl-ctrl-bottom-left,
  .maplibregl-ctrl-bottom-right {
    position: absolute;
    z-index: var(--lr-layer-content);
    pointer-events: none;
  }
  .maplibregl-ctrl-top-left {
    inset-block-start: 0;
    inset-inline-start: 0;
  }
  .maplibregl-ctrl-top-right {
    inset-block-start: 0;
    inset-inline-end: 0;
  }
  .maplibregl-ctrl-bottom-left {
    inset-block-end: 0;
    inset-inline-start: 0;
  }
  .maplibregl-ctrl-bottom-right {
    inset-block-end: 0;
    inset-inline-end: 0;
  }
  .maplibregl-ctrl {
    margin: var(--lr-space-xs);
    pointer-events: auto;
  }
  .maplibregl-ctrl-attrib {
    padding: 0 var(--lr-space-xs);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  .maplibregl-ctrl-attrib a {
    color: var(--lr-color-text-quiet);
    text-decoration: none;
  }
  .maplibregl-ctrl-attrib a:hover {
    text-decoration: underline;
  }
  /* Remove the native <summary> disclosure marker (the stray "▼") on the compact-toggle button. */
  .maplibregl-ctrl-attrib summary {
    list-style: none;
    appearance: none;
    -webkit-appearance: none;
  }
  .maplibregl-ctrl-attrib summary::-webkit-details-marker {
    display: none;
  }
  .maplibregl-ctrl-attrib summary::marker {
    content: '';
  }
`;
