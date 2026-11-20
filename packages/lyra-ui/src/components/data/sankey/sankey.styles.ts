import { css } from 'lit';

export const styles = css`
  .node-shape,
  .link-shape {
    vector-effect: non-scaling-stroke;
    pointer-events: fill;
  }

  .node-shape {
    fill: var(--_lr-sankey-mark-color);
  }

  .link-shape {
    fill: color-mix(in oklab, var(--_lr-sankey-mark-color) 35%, var(--lr-color-surface));
  }

  [part='node']:where(:hover, :focus-visible) .node-shape,
  [part='link']:where(:hover, :focus-visible) .link-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-thin);
  }

  [part='node']:active .node-shape,
  [part='link']:active .link-shape {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-focus-ring-width);
  }

  .mark-label-box {
    overflow: hidden;
    pointer-events: none;
  }

  [part='node-label'],
  [part='link-label'] {
    box-sizing: border-box;
    padding-inline: var(--lr-space-2xs);
    color: var(--lr-color-text);
    background: color-mix(in oklab, var(--lr-color-surface) 85%, transparent);
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-compact);
    overflow: hidden;
    text-overflow: ellipsis;
    unicode-bidi: plaintext;
    white-space: nowrap;
  }

  [part='node-label'] {
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='node-label']:where([data-end]) {
    text-align: end;
  }

  [part='link-label'] {
    text-align: center;
  }

  @media (forced-colors: active) {
    .node-shape {
      forced-color-adjust: none;
      fill: CanvasText;
    }

    .link-shape {
      forced-color-adjust: none;
      fill: Canvas;
      stroke: CanvasText;
    }

    [part='node']:where(:hover, :focus-visible, :active) .node-shape,
    [part='link']:where(:hover, :focus-visible, :active) .link-shape {
      stroke: Highlight;
    }

    [part='node-label'],
    [part='link-label'] {
      color: CanvasText;
      background: Canvas;
    }
  }
`;
