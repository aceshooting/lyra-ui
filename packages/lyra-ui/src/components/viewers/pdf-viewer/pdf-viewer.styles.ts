import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-pdf-viewer-height: var(--lr-size-24rem);
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part="toolbar"] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-brand-quiet);
    font-size: var(--lr-font-size-sm);
    flex-wrap: wrap;
  }
  [part="toolbar"] button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part="toolbar"] button:hover {
    background: var(
      --lr-pdf-viewer-toolbar-button-hover-bg,
      var(--lr-color-surface)
    );
  }
  [part="toolbar"] button:active {
    background: color-mix(
      in oklab,
      var(--lr-pdf-viewer-toolbar-button-hover-bg, var(--lr-color-surface)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="toolbar"] button:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: default;
  }
  [part="toolbar"] button:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="page-indicator"],
  [part="zoom-indicator"] {
    color: var(--lr-color-text);
    white-space: nowrap;
  }
  [part="pages"] {
    --lr-virtual-list-height: var(
      --lr-pdf-viewer-height,
      var(--_lr-pdf-viewer-height)
    );
  }
  lr-virtual-list::part(base) {
    overflow-x: auto;
  }
  /* Everything below renders through <lr-virtual-list>'s renderItem, into that element's own
     shadow root, so a bare [part='x'] can never reach across the boundary and every page-level
     rule goes through ::part(). ::part() also takes no descendant combinator, hence the canvas and
     the generated text runs carrying their own part names instead of page/text-layer
     descendants. */
  lr-virtual-list::part(page) {
    position: relative;
    display: flex;
    /* Centers a fitting page but falls back to the logical start when it overflows, so neither
       edge becomes unreachable through the scroll container. */
    justify-content: safe center;
    inline-size: max-content;
    min-inline-size: 100%;
    padding-block: var(--lr-space-m);
  }
  /* direction:ltr so the canvas 2D context (ctx.direction defaults to 'inherit', the element's
     computed direction) lays PDF.js's explicitly-positioned glyphs out LTR. Under an ancestor
     dir="rtl" the inherited RTL reorders and overlaps the painted text ("Hello, world!" ->
     "H e lb world!"); a PDF's text position is absolute and encoded in the file, never a function
     of the surrounding UI direction. Scoped to the canvas alone, leaving the text-layer's own RTL
     centering (below) untouched. */
  lr-virtual-list::part(page-canvas) {
    box-shadow: 0 0 0 var(--lr-border-width-thin) var(--lr-color-border);
    direction: ltr;
  }
  lr-virtual-list::part(page-error) {
    position: absolute;
    inset-block-start: var(--lr-space-m);
    inset-inline-start: 50%;
    translate: -50% 0;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-size-12rem);
    min-block-size: var(--lr-size-12rem);
    padding: var(--lr-space-l);
    border: var(--lr-border-width-thin) solid var(--lr-color-danger);
    background: var(--lr-color-surface);
    color: var(--lr-color-danger);
    text-align: center;
  }
  lr-virtual-list::part(page-error-visible) {
    display: flex;
  }
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
    /* Nothing in this layer ever paints: it is an invisible, selectable overlay over glyphs the
       canvas already painted. The per-run rule below cannot carry that alone -- part='text-span'
       is stamped onto PDF.js's generated runs only after render() resolves, so runs are
       unreachable while the layer builds, and permanently for any left by a render that aborted
       partway. Transparency on the container becomes the inherited default for whatever PDF.js
       creates here, parted or not; the runs and search marks re-declare it and are unaffected. */
    color: transparent;
  }
  :host(:dir(rtl)) lr-virtual-list::part(text-layer) {
    transform: translateX(50%);
  }
  /* PDF.js's TextLayer sets only inline left/top percentages and CSS custom properties on each
     generated span; the rest -- invisible-but-selectable over the already-painted canvas glyphs,
     and sizing/rotating/skewing each run to match the page -- is expected from the surrounding
     stylesheet, normally web/pdf_viewer.css's .textLayer rules. Ported here since that stylesheet
     isn't shipped with the pdfjs-dist peer. */
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
  /* On the text run itself, not its text-layer container: a highlight pseudo matches against the
     element the selected text originates in, so targeting the run relies on no highlight
     inheritance from an ancestor. */
  lr-virtual-list::part(text-span)::selection {
    background: var(--lr-color-brand-quiet);
  }
  /* Text-transparent like every other text-layer run above, so only the highlighted background
     shows and the canvas's own painted glyphs stay the visible text. ::part() matches with part~=
     semantics, so the active match's two-name part list is reached by naming each part
     separately. */
  lr-virtual-list::part(search-match) {
    background: var(
      --lr-pdf-viewer-search-match-bg,
      var(--lr-color-warning-quiet)
    );
    color: transparent;
    border-radius: var(--lr-radius-xs);
  }
  lr-virtual-list::part(search-match-active) {
    background: var(
      --lr-pdf-viewer-search-match-active-bg,
      var(--lr-color-warning)
    );
  }
  .empty-note,
  [part="error"] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
  [part="spinner"] {
    display: flex;
    justify-content: center;
    padding: var(--lr-space-l);
  }
`;
