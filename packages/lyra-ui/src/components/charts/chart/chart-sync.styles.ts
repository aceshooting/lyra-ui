import { css } from 'lit';

export const chartSyncStyles = css`
  [part='sync-crosshair'],
  [part='sync-tooltip'] {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
  }
  [part='sync-crosshair'] {
    border-inline-start: var(--lr-chart-sync-crosshair-width, var(--lr-border-width-thin)) solid
      var(--lr-chart-sync-crosshair-color, var(--lr-color-text));
    inline-size: 0;
  }
  [part='sync-tooltip'] {
    z-index: var(--lr-layer-content);
    max-inline-size: 100%;
    max-block-size: 100%;
    overflow: auto;
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-chart-tooltip-bg, var(--lr-color-surface));
    color: var(--lr-chart-tooltip-color, var(--lr-color-text));
    font: var(--lr-font-size-sm) var(--lr-font);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  @media (forced-colors: active) {
    [part='sync-crosshair'] { border-color: CanvasText; }
    [part='sync-tooltip'] { background: Canvas; color: CanvasText; border-color: CanvasText; }
  }
`;
