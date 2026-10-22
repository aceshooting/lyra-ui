import { css } from 'lit';

export const panoramaStyles = css`
  [part='panorama'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: var(--lr-size-12rem);
    min-inline-size: var(--lr-icon-button-size);
    border-radius: var(--lr-radius);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
    pointer-events: none;
  }
  [part='panorama']:where([data-ready]) { pointer-events: auto; cursor: grab; }
  [part='panorama']:hover { outline: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='panorama']:focus-visible { outline: var(--lr-focus-ring); }
  [part='panorama']:active { cursor: grabbing; }
  [part='panorama'][hidden] { display: none; }
  [part='panorama-engine'] { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; overflow: hidden; border-radius: inherit; }
  [part='panorama-engine'] canvas { display: block; inline-size: 100%; block-size: 100%; }
  [part='panorama-notice'] { color: var(--lr-color-text-quiet); overflow-wrap: anywhere; }
  [part='panorama-notice'] p { margin: 0; }
  [part='panorama-hotspots'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); min-inline-size: 0; }
  [part='panorama-hotspot'], [part='panorama-page'] {
    transition: var(--lr-transition-interactive);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    color: var(--lr-color-text);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='panorama-hotspot']:hover, [part='panorama-page']:hover { text-decoration: underline; }
  [part='panorama-hotspot']:focus-visible, [part='panorama-page']:focus-visible { outline: var(--lr-focus-ring); outline-offset: var(--lr-focus-ring-offset); }
  [part='panorama-hotspot']:active, [part='panorama-page']:active { border-color: var(--lr-color-brand); }
  [part='panorama-page']:disabled { opacity: var(--lr-opacity-disabled); cursor: default; }
`;
