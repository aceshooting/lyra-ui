import { dialogChrome, dialogOpenHost } from '../../../internal/modal-surface.styles.js';
import { activeFill, disabledControl, focusRingShorthand, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { modalHostStyles } from '../../../internal/native-modal-carrier.styles.js';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { inlineSizeContainer } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    --_lr-lightbox-overlay-color: var(--lr-color-overlay-strong);
    --_lr-lightbox-control-bg: var(--lr-color-neutral);
    --_lr-lightbox-control-color: var(--lr-color-on-neutral);
    ${modalHostStyles}
    max-inline-size: none;
    max-block-size: none;
    ${inlineSizeContainer}
    ${dialogChrome}
  }
  ${dialogOpenHost}
  :host([data-closing]) {
    display: flex;
    pointer-events: none;
  }
  [part="surface"] {
    display: contents;
  }
  /* Slotted items keep the host inline on the page; only the viewer layer is a viewport overlay. */
  :host([data-items]),
  :host([data-items][open]),
  :host([data-items][data-closing]) {
    display: contents;
    position: static;
    padding: 0;
  }
  :host([data-items]) [part="surface"] {
    display: none;
  }
  :host([data-items][open]) [part="surface"],
  :host([data-items][data-closing]) [part="surface"] {
    display: flex;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    ${inlineSizeContainer}
    ${dialogChrome}
  }
  :host([data-items][data-closing]:not([open])) [part="surface"] {
    pointer-events: none;
  }
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(
      --lr-lightbox-overlay-color,
      var(--_lr-lightbox-overlay-color)
    );
  }
  [part~="panel"] {
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
  [part="source-retry"],
  [part="zoom-button"],
  [part="close-button"],
  [part~="previous-button"],
  [part~="next-button"] {
    font: inherit;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    ${iconHitTarget}
    border: none;
    border-radius: var(--lr-radius-pill);
    --_lr-lightbox-control-hover-bg: var(--lr-lightbox-control-hover-bg, var(--lr-color-brand-quiet));
    --_lr-lightbox-control-hover-color: var(--lr-lightbox-control-hover-color, var(--lr-color-brand));
    background: var(--lr-lightbox-control-bg, var(--_lr-lightbox-control-bg));
    color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part="close-button"] {
    margin-inline-start: var(--lr-space-xs);
  }
  :where([part="source-retry"]):hover,
  :where([part="zoom-button"]):hover,
  :where([part="close-button"]):hover,
  :where([part~="previous-button"]):hover:where(:not(:disabled)),
  :where([part~="next-button"]):hover:where(:not(:disabled)) {
    background: var(--_lr-lightbox-control-hover-bg);
    color: var(--_lr-lightbox-control-hover-color);
  }
  :where([part="source-retry"]):active,
  :where([part="zoom-button"]):active,
  :where([part="close-button"]):active,
  :where([part~="previous-button"]):active:where(:not(:disabled)),
  :where([part~="next-button"]):active:where(:not(:disabled)) {
    background: var(
      --lr-lightbox-control-active-bg,
      ${activeFill('var(--_lr-lightbox-control-hover-bg)')}
    );
    color: var(--lr-lightbox-control-active-color, var(--_lr-lightbox-control-hover-color));
  }
  [part="source-retry"]:focus-visible,
  [part="zoom-button"]:focus-visible,
  [part="close-button"]:focus-visible,
  [part~="previous-button"]:focus-visible,
  [part~="next-button"]:focus-visible {
    ${focusRingShorthand}
  }
  [part~="previous-button"]:disabled,
  [part~="next-button"]:disabled {
    ${disabledControl}
  }
  [part="close-button"] svg,
  [part="zoom-button"] svg,
  [part="previous-glyph"],
  [part="next-glyph"] {
    display: block;
  }
  [part="source-loading"], [part="source-error"] {
    position: absolute;
    inset: var(--lr-space-l);
    z-index: var(--lr-layer-content);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    color: var(--lr-lightbox-status-color, var(--lr-color-on-strong-overlay));
    overflow-wrap: anywhere;
  }
  [part="source-retry"] { padding-inline: var(--lr-space-s); }
  [part~="stage"] {
    position: relative;
    touch-action: pan-y pinch-zoom;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part="slide"] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    border-radius: var(--media-border-radius, var(--lr-lightbox-media-radius, 0));
    overflow: hidden;
  }
  lr-pan-zoom[part="frame"] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  lr-pan-zoom[part="frame"][hidden] {
    display: none;
  }
  :host([without-zoom]) lr-pan-zoom[part="frame"]::part(controls) {
    display: none;
  }
  [part="video"] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
    background: var(--lr-lightbox-overlay-color, var(--_lr-lightbox-overlay-color));
  }
  [part~="thumbnails"] {
    display: flex;
    flex: 0 0 auto;
    gap: var(--lr-space-xs);
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: var(--lr-space-xs);
  }
  [part~="thumbnail"] {
    flex: 0 0 auto;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--thumbnail-size, var(--lr-lightbox-thumbnail-size, var(--lr-size-3-5rem)));
    block-size: var(--thumbnail-size, var(--lr-lightbox-thumbnail-size, var(--lr-size-3-5rem)));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius);
    background: var(--lr-lightbox-control-bg, var(--_lr-lightbox-control-bg));
    color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
    cursor: pointer;
    opacity: 0.7;
    transition: var(--lr-transition-interactive);
  }
  [part~="thumbnail"] img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  [part~="thumbnail"]:hover {
    opacity: 1;
  }
  [part~="thumbnail"]:focus-visible {
    ${focusRingShorthand}
  }
  [part~="thumbnail-active"] {
    opacity: 1;
    border-color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
  }
  lr-pan-zoom[part="frame"]::part(base) {
    block-size: 100%;
  }
  lr-pan-zoom[part="frame"]::part(viewport) {
    block-size: 100%;
  }
  [part~="previous-button"],
  [part~="next-button"] {
    position: absolute;
    inset-block-start: 50%;
    transform: translateY(-50%);
    z-index: var(--lr-layer-content);
  }
  [part~="previous-button"] {
    inset-inline-start: var(--lr-space-s);
  }
  [part~="next-button"] {
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
    /* overflow-x paired with overflow-y so a caption that never actually overflows horizontally
       (max-inline-size + overflow-wrap already prevent that) cannot show a spurious empty
       horizontal scrollbar from sub-pixel rounding on a single-axis overflow: auto. */
    overflow-x: hidden;
    overflow-y: auto;
    align-self: center;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    background: var(--lr-lightbox-control-bg, var(--_lr-lightbox-control-bg));
    color: var(--lr-lightbox-control-color, var(--_lr-lightbox-control-color));
    text-align: center;
    overflow-wrap: anywhere;
  }
  [part="caption"]:focus-visible {
    ${focusRingShorthand}
  }
  @container ${compactContainerQuery} {
    [part="counter"] {
      max-inline-size: 45%;
    }
  }
`;
