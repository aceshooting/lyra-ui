import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-pdf-viewer-height: var(--lyra-size-24rem); }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='toolbar'] { display: flex; align-items: center; gap: var(--lyra-space-s); padding: var(--lyra-space-xs) var(--lyra-space-s); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); background: var(--lyra-color-brand-quiet); font-size: var(--lyra-font-size-sm); flex-wrap: wrap; }
  [part='toolbar'] button { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lyra-icon-button-size); min-block-size: var(--lyra-icon-button-size); border: none; border-radius: var(--lyra-radius); background: transparent; color: var(--lyra-color-text); cursor: pointer; }
  [part='toolbar'] button:disabled { opacity: var(--lyra-opacity-disabled); cursor: default; }
  [part='toolbar'] button:focus-visible { outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  [part='page-indicator'], [part='zoom-indicator'] { color: var(--lyra-color-text); white-space: nowrap; }
  [part='pages'] { --lyra-virtual-list-height: var(--lyra-pdf-viewer-height); }
  [part='page'] { position: relative; display: flex; justify-content: center; padding-block: var(--lyra-space-m); min-inline-size: 0; }
  [part='page'] canvas { box-shadow: 0 0 0 var(--lyra-border-width-thin) var(--lyra-color-border); }
  [part='text-layer'] {
    position: absolute;
    inset-block-start: var(--lyra-space-m);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    overflow: hidden;
    /* Must resolve to 1: PDF.js positions each text run assuming the line box
       exactly equals the glyph height, so selection aligns with the canvas. */
    line-height: var(--lyra-line-height-none);
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
  [part='text-layer'] ::selection { background: var(--lyra-color-brand-quiet); }
  /* Kept text-transparent like every other text-layer run above -- only the highlighted background
     should show, letting the canvas's own painted glyphs remain the visible text underneath. */
  [part='text-layer'] mark[part~='search-match'] { background: var(--lyra-color-warning-quiet); color: transparent; border-radius: var(--lyra-radius-xs); }
  [part='text-layer'] mark[part~='search-match-active'] { background: var(--lyra-color-warning); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-l); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); text-align: center; }
  [part='error'] { color: var(--lyra-color-danger); }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
