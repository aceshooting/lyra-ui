import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: var(--lr-space-s); padding: var(--lr-space-m); border: var(--lr-border-width-thin) solid var(--lr-callout-border, var(--lr-color-border)); border-radius: var(--lr-radius-xs); background: var(--lr-callout-background, var(--lr-color-surface)); color: var(--lr-callout-color, var(--lr-color-text)); }
  :host([variant='brand']) { --lr-callout-background: var(--lr-color-brand-quiet); --lr-callout-color: var(--lr-color-brand); --lr-callout-border: var(--lr-color-brand); }
  :host([variant='success']) { --lr-callout-background: var(--lr-color-success-quiet); --lr-callout-color: var(--lr-color-success); --lr-callout-border: var(--lr-color-success); }
  :host([variant='warning']) { --lr-callout-background: var(--lr-color-warning-quiet); --lr-callout-color: var(--lr-color-warning); --lr-callout-border: var(--lr-color-warning); }
  :host([variant='danger']) { --lr-callout-background: var(--lr-color-danger-quiet); --lr-callout-color: var(--lr-color-danger); --lr-callout-border: var(--lr-color-danger); }
  [part='icon'] { display: inline-flex; font-size: var(--lr-font-size-lg); line-height: var(--lr-line-height-none); }
  [part='icon'][hidden], [part='close-button'][hidden] { display: none; }
  [part='heading'] { margin-block-end: var(--lr-space-xs); font-weight: var(--lr-font-weight-semibold); }
  [part='content'] { min-inline-size: 0; }
  /* The interactive hit target meets the shared minimum tappable size (--lr-icon-button-size)
     in both the default panel and the compact [inline] variant below -- the *visible* "×" glyph
     is what shrinks for [inline] instead, rendered on the separate [part='close-icon'] child and
     centered via this button's own flex layout, not by resizing the button itself. Mirrors
     lr-swatch-picker's [part='swatch']/[part='swatch-fill'] split. */
  [part='close-button'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: 0; border-radius: var(--lr-radius-pill); background: transparent; color: inherit; cursor: pointer; }
  [part='close-button']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host([inline]) [part='base'] {
    gap: var(--lr-space-xs);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  :host([inline]) [part='icon'] { font-size: var(--lr-font-size-md); }
  :host([inline]) [part='heading'] { margin-block-end: 0; }
  :host([inline]) [part='close-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
  }
`;
