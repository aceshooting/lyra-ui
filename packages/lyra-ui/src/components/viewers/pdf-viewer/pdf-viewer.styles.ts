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
  lr-virtual-list::part(base) { overflow-x: auto; }
  /* Everything below renders through <lr-virtual-list>'s renderItem, i.e. into that element's own
     shadow root rather than this one -- a bare [part='x'] selector can never reach across that
     boundary, so each page-level rule goes through ::part(). ::part() cannot be followed by a
     descendant combinator either, which is why the canvas and the generated text runs carry their
     own part names instead of being addressed as descendants of page/text-layer. */
  lr-virtual-list::part(page) {
    position: relative;
    display: flex;
    justify-content: flex-start;
    inline-size: max-content;
    min-inline-size: 100%;
    padding-block: var(--lr-space-m);
    direction: ltr;
  }
  /* direction:ltr so the canvas 2D context (which defaults ctx.direction to 'inherit' -> the
     element's computed direction) lays PDF.js's explicitly-positioned glyphs out LTR. Under an
     ancestor dir="rtl" the inherited RTL direction otherwise reorders/overlaps the painted text
     ("Hello, world!" -> "H e lb world!"); a PDF's text position is absolute and encoded in the
     file, never a function of the surrounding UI direction. Scoped to the canvas alone so the
     text-layer's own RTL centering (below) is untouched. */
  lr-virtual-list::part(page-canvas) { box-shadow: 0 0 0 var(--lr-border-width-thin) var(--lr-color-border); direction: ltr; }
  lr-virtual-list::part(text-layer) {
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
  :host(:dir(rtl)) lr-virtual-list::part(text-layer) { transform: translateX(50%); }
  /* PDF.js's TextLayer only sets inline left/top percentages and CSS custom properties on each
     generated span -- everything else (making the run invisible-but-selectable over the already-
     painted canvas glyphs, and sizing/rotating/skewing each run to match the page) is expected to
     come from the surrounding stylesheet, normally web/pdf_viewer.css's .textLayer rules. Ported
     here since that stylesheet isn't shipped with the pdfjs-dist peer. */
  lr-virtual-list::part(text-span) {
    position: absolute;
    color: transparent;
    white-space: pre;
    cursor: text;
    user-select: text;
    transform-origin: 0 0;
    font-size: calc(var(--total-scale-factor, 1) * var(--font-height));
    transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1));
  }
  /* Attached to the text run itself rather than to its text-layer container: a highlight pseudo is
     matched against the element the selected text actually originates in, so targeting the run needs
     no reliance on highlight inheritance propagating down from an ancestor. */
  lr-virtual-list::part(text-span)::selection { background: var(--lr-color-brand-quiet); }
  /* Kept text-transparent like every other text-layer run above -- only the highlighted background
     should show, letting the canvas's own painted glyphs remain the visible text underneath.
     ::part() already matches on part~= semantics, so the active match's two-name part list is
     reached by naming each part separately. */
  lr-virtual-list::part(search-match) { background: var(--lr-color-warning-quiet); color: transparent; border-radius: var(--lr-radius-xs); }
  lr-virtual-list::part(search-match-active) { background: var(--lr-color-warning); }
  .empty-note, [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); text-align: center; }
  [part='error'] { color: var(--lr-color-danger); }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
