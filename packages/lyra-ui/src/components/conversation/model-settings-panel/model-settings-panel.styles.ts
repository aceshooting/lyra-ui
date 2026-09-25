import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    /* The 28rem ceiling is the shipped default, kept so no existing layout moves, but read as a
       var() fallback so a settings page can widen the card (or set none for a full-width row)
       without a descendant override. Never declared on :host, so an ancestor theme wrapper's
       value still reaches it. */
    max-inline-size: var(--lr-model-settings-panel-max-inline-size, var(--lr-size-28rem));
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    box-sizing: border-box;
    padding: var(--lr-space-l);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='model-row'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  /* The nested control's own width ceiling (24rem, sized for a standalone dropdown) would
     otherwise clip a full-width row inside this card. lr-model-select now publishes that ceiling
     as a name, so this sets the name rather than reaching past the child's own rule with a
     descendant override -- the same one-declaration opt-out any consumer gets. */
  [part='model-row'] {
    --lr-model-select-max-inline-size: none;
  }
  [part='model-row'] lr-model-select {
    inline-size: 100%;
  }

  [part='temperature-row'] {
    display: grid;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='temperature-row'] lr-slider {
    min-inline-size: 0;
  }
  [part='temperature-label'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
  }
  [part='temperature-value'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
    min-inline-size: var(--lr-size-2-5ch);
    text-align: end;
  }

  /* Compact layout: the two rows sit side by side instead of stacked and the temperature caption
     shrinks to an uppercase micro-label -- denser, for toolbars/sidebars where the vertical
     layout's full-height rows do not fit. */
  :host([layout='compact']) {
    /* Compact uncaps the card, but through the SAME name the default layout reads: a bare
       max-inline-size: none here is a higher-specificity rule that replaces the hook's whole
       fallback chain, so --lr-model-settings-panel-max-inline-size did nothing at all in this
       layout while the docs promised it everywhere. Folding the uncap into the fallback keeps the
       compact default exactly where it was and leaves the name live in both layouts. */
    max-inline-size: var(--lr-model-settings-panel-max-inline-size, none);
  }
  :host([layout='compact']) [part='base'] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--lr-space-m);
    padding: var(--lr-space-m);
  }
  :host([layout='compact']) [part='model-row'],
  :host([layout='compact']) [part='temperature-row'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: var(--lr-size-10rem);
  }
  :host([layout='compact']) [part='temperature-label'] {
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
  }
`;
