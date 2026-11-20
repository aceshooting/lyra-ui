import { css } from 'lit';

export const styles = css`
  .region-shape {
    fill: var(--_lr-choropleth-fill);
    stroke: var(--_lr-choropleth-stroke);
    stroke-width: var(--lr-border-width-thin);
    vector-effect: non-scaling-stroke;
    pointer-events: fill;
  }

  [part='region']:where(:hover, :focus-visible) .region-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-medium);
  }

  [part='region']:active .region-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-focus-ring-width);
  }

  .region-label-box {
    overflow: hidden;
    pointer-events: none;
  }

  [part='region-label'] {
    box-sizing: border-box;
    padding-inline: var(--lr-space-2xs);
    color: var(--lr-color-text);
    background: color-mix(in oklab, var(--lr-color-surface) 90%, transparent);
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-compact);
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    unicode-bidi: plaintext;
    white-space: nowrap;
  }

  @media (forced-colors: active) {
    .region-shape {
      forced-color-adjust: none;
      fill: Canvas;
      stroke: CanvasText;
    }

    .region-shape:where([data-missing]) {
      stroke-dasharray: var(--lr-size-2px);
    }

    [part='region']:where(:hover, :focus-visible, :active) .region-shape {
      stroke: Highlight;
    }

    [part='region-label'] {
      color: CanvasText;
      background: Canvas;
    }
  }
`;
