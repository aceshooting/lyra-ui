import { css } from 'lit';

export const styles = css`
  :host {
    --_lr-lightbox-overlay-color: var(--lr-color-overlay-strong);
    /* Background for every floating/toolbar icon button (close-button, previous-button,
       next-button). They float over arbitrary image content, not the app's normal surface, so they
       take the solid high-contrast neutral fill token rather than --lr-color-surface -- contrast
       independent of the page theme and of whatever is in the photo. */
    --_lr-lightbox-control-bg: var(--lr-color-neutral);
    --_lr-lightbox-control-color: var(--lr-color-on-neutral);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(
      var(--lr-space-l),
      var(--lr-safe-area-inline-start)
    );
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(
      --lr-lightbox-overlay-color,
      var(--_lr-lightbox-overlay-color)
    );
  }
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    outline: none;
  }
  [part="toolbar"] {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }
  [part="counter"] {
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-lightbox-control-bg, var(--_lr-lightbox-control-bg));
    color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
    font-size: var(--lr-font-size-sm);
  }
  [part="actions"] {
    display: flex;
    align-items: center;
    flex: 1 1 0;
    flex-wrap: wrap;
    justify-content: flex-end;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-xs);
    margin-inline-start: auto;
  }
  slot[name="actions"]::slotted(*) {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="actions"][hidden] {
    display: none;
  }
  [part="close-button"],
  [part="previous-button"],
  [part="next-button"] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius-pill);
    background: var(--lr-lightbox-control-bg, var(--_lr-lightbox-control-bg));
    color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
    cursor: pointer;
  }
  [part="close-button"] {
    margin-inline-start: var(--lr-space-xs);
  }
  /* :where() zeroes the wrapped selectors, leaving only :hover -- (0,1,0), the same weight as the
     pressed rule below, which therefore takes the control on source order while the pointer is
     down. */
  :where([part="close-button"]):hover,
  :where([part="previous-button"]):hover:where(:not(:disabled)),
  :where([part="next-button"]):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Pressed carries the hover fill further toward --lr-color-mix-partner: these controls float
     over arbitrary photography, so the press must be legible on its own rather than relying on the
     image for contrast. */
  :where([part="close-button"]):active,
  :where([part="previous-button"]):active:where(:not(:disabled)),
  :where([part="next-button"]):active:where(:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    color: var(--lr-color-brand);
  }
  [part="close-button"]:focus-visible,
  [part="previous-button"]:focus-visible,
  [part="next-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="previous-button"]:disabled,
  [part="next-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="close-button"] svg,
  [part="previous-glyph"],
  [part="next-glyph"] {
    display: block;
  }
  [part="stage"] {
    position: relative;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
  }
  /* Plain ::part() styling one level in, unrelated to exportparts -- stretches the embedded
     frame to fill the stage, overriding pan-zoom's own min-block-size default. */
  lr-pan-zoom[part="frame"] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  lr-pan-zoom[part="frame"]::part(base) {
    block-size: 100%;
  }
  lr-pan-zoom[part="frame"]::part(viewport) {
    block-size: 100%;
  }
  [part="previous-button"],
  [part="next-button"] {
    position: absolute;
    inset-block-start: 50%;
    transform: translateY(-50%);
    z-index: var(--lr-layer-content);
  }
  [part="previous-button"] {
    inset-inline-start: var(--lr-space-s);
  }
  [part="next-button"] {
    inset-inline-end: var(--lr-space-s);
  }
  /* Rotate the wrapping part element, not the icon -- rotate(180deg) matches
     pagination.styles.ts's previous-icon/next-icon recipe for a chevronIcon()-based prev/next
     pair; carousel's scaleX(-1) recipe is for its literal ‹/› glyphs, a different base case. */
  [part="previous-glyph"] {
    transform: rotate(180deg);
  }
  [part="next-glyph"] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part="previous-glyph"] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part="next-glyph"] {
    transform: rotate(180deg);
  }
  [part="caption"] {
    flex: 0 0 auto;
    margin: 0;
    max-inline-size: 100%;
    max-block-size: var(--lr-size-8rem);
    overflow-y: auto;
    align-self: center;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-lightbox-control-bg, var(--_lr-lightbox-control-bg));
    color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
    text-align: center;
    overflow-wrap: anywhere;
  }
  /* Container-query lengths cannot reference custom properties, so the documented 320px
     narrow-allocation baseline is expressed in root-relative units and still follows the page's
     type scale -- mirrors pagination.styles.ts's container query. */
  @container (max-inline-size: 20rem) {
    [part="counter"] {
      max-inline-size: 45%;
    }
  }
`;
