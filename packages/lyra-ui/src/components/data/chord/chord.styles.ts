import { css } from 'lit';

export const styles = css`
  /* The viewBox follows this rendered box, so one user unit is one CSS pixel. */
  [part='plot'] {
    block-size: var(--lr-chord-height, clamp(var(--lr-size-16rem), 100cqi, var(--lr-size-30rem)));
  }

  .arc-shape,
  .ribbon-shape {
    vector-effect: non-scaling-stroke;
    pointer-events: fill;
  }

  .arc-shape {
    fill: var(--_lr-chord-mark-color);
  }

  .ribbon-shape {
    fill: color-mix(in oklab, var(--_lr-chord-mark-color) 40%, var(--lr-color-surface));
  }

  .ribbon-shape:where([data-highlighted]) {
    fill: color-mix(in oklab, var(--_lr-chord-mark-color) 80%, var(--lr-color-surface));
  }

  [part='entity']:where(:hover, :focus-visible) .arc-shape,
  [part='ribbon']:where(:hover, :focus-visible) .ribbon-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-thin);
  }

  [part='entity']:active .arc-shape,
  [part='ribbon']:active .ribbon-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-focus-ring-width);
  }

  .entity-label-box {
    overflow: hidden;
    pointer-events: none;
  }

  [part='entity-label'] {
    box-sizing: border-box;
    padding-inline: var(--lr-space-2xs);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-compact);
    overflow: hidden;
    text-overflow: ellipsis;
    unicode-bidi: plaintext;
    white-space: nowrap;
  }

  [part='entity-label']:where([data-align='end']) {
    text-align: end;
  }

  [part='entity-label']:where([data-align='center']) {
    text-align: center;
  }

  @media (forced-colors: active) {
    .arc-shape {
      forced-color-adjust: none;
      fill: CanvasText;
    }

    .ribbon-shape {
      forced-color-adjust: none;
      fill: Canvas;
      stroke: CanvasText;
    }

    .ribbon-shape:where([data-highlighted]) {
      stroke: Highlight;
    }

    [part='entity']:where(:hover, :focus-visible, :active) .arc-shape,
    [part='ribbon']:where(:hover, :focus-visible, :active) .ribbon-shape {
      stroke: Highlight;
    }

    [part='entity-label'] {
      color: CanvasText;
    }
  }
`;
