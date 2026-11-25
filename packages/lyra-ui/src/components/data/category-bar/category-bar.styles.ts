import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  :host {
    display: block;
    font-family: var(--lr-font);
    color: var(--lr-color-text);
  }

  [part='base'] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
    /* Respond to the allocation the bar receives, not to the viewport. The intrinsic size keeps a
       shrink-to-fit flex or grid placement from collapsing to zero under inline-size containment. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-16rem);
    box-sizing: border-box;
  }

  .graphic {
    position: relative;
    /* Room above and below the bar for the marker, which is taller than the bar it points into. */
    padding-block: var(--lr-space-2xs);
  }

  [part='bar'] {
    display: flex;
    gap: var(--lr-border-width-thin);
    block-size: var(--lr-category-bar-size, var(--lr-size-0-5rem));
    overflow: hidden;
    border-radius: var(--lr-radius-pill);
  }

  [part='range'] {
    display: block;
    flex: 0 1 auto;
    min-inline-size: 0;
    background: var(--_lr-category-bar-color);
  }

  [part='marker'] {
    position: absolute;
    inset-block: 0;
    inline-size: var(--lr-border-width-thick);
    margin-inline-start: calc(var(--lr-border-width-thick) / -2);
    background: var(--lr-category-bar-marker-color, var(--lr-color-text));
    border-radius: var(--lr-radius-pill);
    box-shadow: 0 0 0 var(--lr-border-width-thin) var(--lr-color-surface);
    transition: inset-inline-start var(--lr-transition-base);
  }

  [part='labels'] {
    position: relative;
    display: flex;
    min-inline-size: 0;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }

  [part='range-label'] {
    flex: none;
    min-inline-size: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: clip;
    text-align: start;
  }

  [part='range-label'][data-end] {
    position: absolute;
    inset-inline-end: 0;
  }

  [part='empty'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: start;
  }

  /* In a narrow allocation only the scale's two ends keep their values; inner boundary values
     would otherwise collide. */
  @container ${compactContainerQuery} {
    [part='range-label']:not(:first-child):not([data-end]) {
      visibility: hidden;
    }
  }

  @media (forced-colors: active) {
    [part='bar'] {
      border: var(--lr-border-width-thin) solid CanvasText;
    }
    [part='range'] {
      forced-color-adjust: none;
      background: Canvas;
      border-inline-end: var(--lr-border-width-thin) solid CanvasText;
    }
    [part='marker'] {
      forced-color-adjust: none;
      background: Highlight;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='marker'] {
      transition: none;
    }
  }
`;
