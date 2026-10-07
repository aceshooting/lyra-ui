import { css } from 'lit';
import { flowStatusPaint } from '../flow-canvas/flow-status.styles.js';

export const styles = css`
  ${flowStatusPaint}
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    /* Resting chrome despite the element's name: an in-flow status strip (plain display:block
       host, no positioning of its own, usually dropped into a toolbar beside the canvas), not a
       layer floating above the page. */
    box-shadow: var(--lr-shadow-s);
    font-size: var(--lr-font-size-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* Chrome-less escape, mirroring the shared LyraFrame vocabulary's frame="plain" (and
     lr-callout's [inline]): the strip often sits inside a host toolbar that already draws its own
     border/background, where this floating-surface chrome doubles the frame. Only the box
     decoration goes -- the flex layout, gap and per-status count dots stay. */
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  [part='summary'] {
    font-weight: var(--lr-font-weight-medium);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='count'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    color: var(--lr-color-text-quiet);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  .tone-dot {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--_lr-flow-status-paint, var(--lr-flow-status-color, var(--lr-color-border-strong)));
    flex: 0 0 auto;
  }
`;
