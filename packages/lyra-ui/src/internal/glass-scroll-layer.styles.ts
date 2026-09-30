import { css } from 'lit';

/** The zero-size sticky anchor leaves the public surface in charge of scrolling and geometry. */
export const glassScrollLayerStyles = css`
  .glass-scroll-layer {
    display: block;
    position: sticky;
    inset-block-start: 0;
    inline-size: 0;
    block-size: 0;
    min-inline-size: 0;
    min-block-size: 0;
    flex: 0 0 0;
    order: -1;
    align-self: flex-start;
    pointer-events: none;
    border-radius: inherit;
    /* Keep this invisible geometry anchor behind the surface using shared stack levels. */
    z-index: calc(var(--lr-layer-base) - var(--lr-layer-content));
    transform: translate(calc(var(--_lr-glass-scroll-offset, 0px) - var(--_lr-glass-padding-inline-start, 0px)), calc(-1 * var(--_lr-glass-padding-top, 0px)));
  }
  :host(:dir(rtl)) .glass-scroll-layer {
    transform: translate(calc(var(--_lr-glass-scroll-offset, 0px) + var(--_lr-glass-padding-inline-start, 0px)), calc(-1 * var(--_lr-glass-padding-top, 0px)));
  }
`;
