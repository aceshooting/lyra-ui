import { css } from 'lit';

export const styles = css`
  :host { display: block; --lr-pdf-viewer-height: var(--lr-size-24rem); }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); overflow: hidden; }
  [part='toolbar'] { display: flex; align-items: center; gap: var(--lr-space-s); padding: var(--lr-space-xs) var(--lr-space-s); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); background: var(--lr-color-brand-quiet); font-size: var(--lr-font-size-sm); flex-wrap: wrap; }
  [part='toolbar'] button { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: none; border-radius: var(--lr-radius); background: transparent; color: var(--lr-color-text); cursor: pointer; }
  [part='toolbar'] button:hover { background: var(--lr-color-brand-quiet); }
  [part='toolbar'] button:disabled { opacity: var(--lr-opacity-disabled); cursor: default; }
  [part='toolbar'] button:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='page-indicator'], [part='zoom-indicator'] { color: var(--lr-color-text); white-space: nowrap; }
  [part='pages'] { --lr-virtual-list-height: var(--lr-pdf-viewer-height); }
  [part='page'] { position: relative; display: flex; justify-content: center; padding-block: var(--lr-space-m); min-inline-size: 0; }
  [part='page'] canvas { box-shadow: 0 0 0 var(--lr-border-width-thin) var(--lr-color-border); }
  [part='text-layer'] {
    position: absolute;
    inset-block-start: var(--lr-space-m);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    overflow: hidden;
    /* Must resolve to 1: PDF.js positions each text run assuming the line box
       exactly equals the glyph height, so selection aligns with the canvas. */
    line-height: var(--lr-line-height-none);
    opacity: 1;
  }
  :host(:dir(rtl)) [part='text-layer'] { transform: translateX(50%); }
  /* PDF.js's TextLayer only sets inline left/top percentages and CSS custom properties on each
     generated span -- everything else (making the run invisible-but-selectable over the already-
     painted canvas glyphs, and sizing/rotating/skewing each run to match the page) is expected to
     come from the surrounding stylesheet, normally web/pdf_viewer.css's .textLayer rules. Ported
     here since that stylesheet isn't shipped with the pdfjs-dist peer. */
  [part='text-layer'] :is(span, br) {
    position: absolute;
    color: transparent;
    white-space: pre;
    cursor: text;
    user-select: text;
    transform-origin: 0 0;
    font-size: calc(var(--total-scale-factor, 1) * var(--font-height));
    transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1));
  }
  [part='text-layer'] ::selection { background: var(--lr-color-brand-quiet); }
  /* Kept text-transparent like every other text-layer run above -- only the highlighted background
     should show, letting the canvas's own painted glyphs remain the visible text underneath. */
  [part='text-layer'] mark[part~='search-match'] { background: var(--lr-color-warning-quiet); color: transparent; border-radius: var(--lr-radius-xs); }
  [part='text-layer'] mark[part~='search-match-active'] { background: var(--lr-color-warning); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); text-align: center; }
  [part='error'] { color: var(--lr-color-danger); }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
