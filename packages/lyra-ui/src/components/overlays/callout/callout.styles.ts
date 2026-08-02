import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    box-sizing: border-box;
    max-inline-size: 100%;
    /* The close hover is independently themeable so retinting it never changes the host surface. */
    --lr-callout-close-hover-bg: var(--lr-color-brand-quiet);
    /* Unset nested callouts inherit the generic semantic and size slots. The second arms are the
       standalone brand/m defaults; explicit attributes re-point the generic slots in the
       contextual vocabulary sheets. */
    --lr-callout-background: var(--lr-color-fill-quiet, var(--lr-color-brand-fill-quiet));
    --lr-callout-border: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
    --lr-callout-color: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
    --lr-callout-font-size: var(--lr-form-control-font-size, var(--lr-font-size-m));
    --lr-callout-padding: var(--lr-form-control-padding-inline, var(--lr-space-m));
    /* Separates three adjacent boxes rather than setting the panel's density, so it deliberately
       does not vary by tier -- shrinking it at 2xs only crowds the close control. */
    --lr-callout-gap: var(--lr-space-s);

    padding: var(--lr-callout-padding);
    border: var(--lr-border-width-thin) solid var(--lr-callout-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-callout-background);
    color: var(--lr-callout-color);
    font-size: var(--lr-callout-font-size);
  }
  [part='base'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    max-inline-size: 100%;
    box-sizing: border-box;
    gap: var(--lr-callout-gap);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font-size: inherit;
  }
  :host([appearance='filled-outlined']) {
    --lr-callout-background: var(--lr-color-fill-quiet, var(--lr-color-brand-fill-quiet));
    --lr-callout-border: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
    --lr-callout-color: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
  }
  :host([appearance='filled']) {
    --lr-callout-background: var(--lr-color-fill-quiet, var(--lr-color-brand-fill-quiet));
    --lr-callout-border: transparent;
    --lr-callout-color: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
  }
  :host([appearance='outlined']) {
    --lr-callout-background: transparent;
    --lr-callout-border: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
    --lr-callout-color: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
  }
  :host([appearance='accent']) {
    --lr-callout-background: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
    --lr-callout-border: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
    --lr-callout-color: var(--lr-color-on-loud, var(--lr-color-brand-on-loud));
  }
  :host([appearance='plain']) {
    --lr-callout-background: transparent;
    --lr-callout-border: transparent;
    --lr-callout-color: var(--lr-color-fill-loud, var(--lr-color-brand-fill-loud));
  }
  [part='icon'] { display: inline-flex; grid-column: 1; font-size: var(--lr-font-size-lg); line-height: var(--lr-line-height-none); }
  [part='icon'][hidden], [part='close-button'][hidden] { display: none; }
  [part='heading'] { margin-block-end: var(--lr-space-xs); font-weight: var(--lr-font-weight-semibold); }
  [part='content'] { grid-column: 2; min-inline-size: 0; overflow-wrap: anywhere; }
  [part='message'] { min-inline-size: 0; overflow-wrap: anywhere; }
  /* The interactive hit target meets the shared minimum tappable size (--lr-icon-button-size)
     in both the default panel and the compact [inline] variant below -- the *visible* "×" glyph
     is what shrinks for [inline] instead, rendered on the separate [part='close-icon'] child and
     centered via this button's own flex layout, not by resizing the button itself. Mirrors
     lr-swatch-picker's [part='swatch']/[part='swatch-fill'] split. */
  [part='close-button'] { display: inline-flex; grid-column: 3; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: 0; border-radius: var(--lr-radius-pill); background: transparent; color: inherit; cursor: pointer; }
  [part='close-button']:where(:hover) { background: var(--lr-callout-close-hover-bg); }
  [part='close-button']:where(:active) { background: color-mix(in oklab, var(--lr-callout-close-hover-bg), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  [part='close-button']:where(:focus-visible) { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host(:where([inline])) {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :host(:where([inline])) [part='base'] { gap: var(--lr-space-xs); }
  :host(:where([inline])) [part='icon'] { font-size: var(--lr-font-size-m); }
  :host(:where([inline])) [part='heading'] { margin-block-end: 0; }
  :host(:where([inline])) [part='close-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
  }
  :host(:where(:not([open]))) {
    display: none;
  }
`;
