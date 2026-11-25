import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  /* The host is the query container so the base layout itself can respond to the allocation.
     The intrinsic size keeps a shrink-to-fit flex or grid placement from collapsing to zero under
     inline-size containment. */
  :host {
    display: block;
    font-family: var(--lr-font);
    color: var(--lr-color-text);
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-16rem);
  }

  [part='base'] {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-m);
    min-inline-size: 0;
    box-sizing: border-box;
  }

  [part='chart'] {
    display: block;
    flex: none;
    inline-size: var(--lr-radial-bar-size, var(--lr-size-12rem));
    max-inline-size: 100%;
    block-size: auto;
    aspect-ratio: 1;
  }

  /* The arcs start at the top and run clockwise; a right-to-left reading direction mirrors them. */
  :host(:dir(rtl)) [part='chart'] {
    transform: scaleX(-1);
  }

  [part='track'],
  [part='arc'] {
    fill: none;
  }

  [part='track'] {
    stroke: var(--lr-radial-bar-track-color, var(--lr-color-surface-raised));
  }

  [part='arc'] {
    stroke: var(--_lr-radial-bar-color);
    stroke-linecap: round;
    transition: stroke-dasharray var(--lr-transition-base);
  }

  [part='legend'] {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }

  [part='legend-item'] {
    display: flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    font-size: var(--lr-font-size-sm);
  }

  [part='legend-swatch'] {
    flex: none;
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-xs);
    background: var(--_lr-radial-bar-color);
  }

  [part='legend-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    text-align: start;
    font-variant-numeric: tabular-nums;
  }

  [part='empty'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }

  /* A narrow allocation stacks the legend under the drawing instead of squeezing it beside. */
  @container ${compactContainerQuery} {
    [part='base'] {
      flex-direction: column;
      align-items: stretch;
    }
    [part='chart'] {
      align-self: center;
    }
  }

  @media (forced-colors: active) {
    [part='track'] {
      stroke: GrayText;
    }
    [part='arc'] {
      stroke: CanvasText;
    }
    [part='legend-swatch'] {
      forced-color-adjust: none;
      background: CanvasText;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='arc'] {
      transition: none;
    }
  }
`;
