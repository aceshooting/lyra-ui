import { css } from 'lit';

export const styles = css`
  /* The viewBox follows this rendered box, so one user unit is one CSS pixel. */
  [part='plot'] {
    block-size: var(--lr-treemap-height, clamp(var(--lr-size-12rem), 62.5cqi, var(--lr-size-30rem)));
  }

  .tile-shape {
    fill: color-mix(in oklab, var(--_lr-treemap-tile-color) 28%, var(--lr-color-surface));
    stroke: var(--lr-color-surface);
    stroke-width: var(--lr-border-width-thin);
    vector-effect: non-scaling-stroke;
    pointer-events: fill;
  }

  .tile-shape:where([data-branch]) {
    fill: color-mix(in oklab, var(--_lr-treemap-tile-color) 43%, var(--lr-color-surface));
  }

  [part='tile']:where(:hover, :focus-visible) .tile-shape {
    stroke: var(--lr-color-text);
  }

  [part='tile']:active .tile-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-focus-ring-width);
  }

  .tile-label-box {
    overflow: hidden;
    pointer-events: none;
  }

  [part='tile-label'] {
    box-sizing: border-box;
    padding: var(--lr-space-2xs) var(--lr-space-xs) 0;
    overflow: hidden;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-compact);
    text-overflow: ellipsis;
    white-space: nowrap;
    unicode-bidi: plaintext;
  }

  @media (forced-colors: active) {
    .tile-shape {
      fill: Canvas;
      stroke: CanvasText;
    }

    .tile-shape:where([data-branch]) {
      fill: ButtonFace;
    }

    [part='tile']:where(:hover, :focus-visible) .tile-shape {
      stroke: Highlight;
    }

    [part='tile-label'] {
      color: CanvasText;
    }
  }
`;
