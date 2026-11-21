import { activeFill, focusRing, hoverFill, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part~='item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--lr-size-2px) var(--lr-space-xs);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
  }
  button[part~='item'] {
    box-sizing: border-box;
    ${iconHitTarget}
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: var(--lr-transition-interactive);
  }
  button[part~='item']:hover {
    background: var(--lr-graph-legend-item-hover-bg, ${hoverFill('transparent')});
  }
  button[part~='item']:active {
    background: ${activeFill('transparent')};
  }
  button[part~='item']:focus-visible {
    ${focusRing}
  }
  /* Opacity dims only the decorative (aria-hidden) swatch; the text parts re-color through the
     quiet-text token instead, so a hidden item's label keeps AA contrast rather than fading toward
     the background -- opacity on the whole item drops label contrast below 4.5:1. */
  [part~='item'][data-hidden] [part='swatch'] {
    opacity: var(--lr-graph-legend-hidden-swatch-opacity, 0.5);
  }
  [part~='item'][data-hidden] [part='label'],
  [part~='item'][data-hidden] [part='count'] {
    color: var(--lr-graph-legend-hidden-color, var(--lr-color-text-quiet));
  }
  [part='swatch'] {
    inline-size: var(--lr-size-0-75em);
    block-size: var(--lr-size-0-75em);
    flex: 0 0 auto;
    display: block;
    color: var(--lr-color-text);
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='count'] {
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
  [part='limit'] {
    margin: var(--lr-space-xs) 0 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  @media (forced-colors: active) {
    [part='swatch'] {
      forced-color-adjust: none;
    }
  }
`;
