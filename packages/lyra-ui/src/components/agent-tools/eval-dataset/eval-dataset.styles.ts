import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='add-button'],
  [part='remove-button'] {
    display: inline-flex;
    align-items: center;
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  /* Hover changes the border while the distinct pressed step below changes the surface fill. */
  :where([part='add-button']):hover:where(:not(:disabled)),
  :where([part='remove-button']):hover:where(:not(:disabled)) {
    border-color: var(--lr-color-brand);
  }
  /* Hover recolours the border only, leaving the pressed step nothing to deepen, so pressed tints
     the button's own surface fill toward --lr-color-mix-partner, which follows the text colour --
     darkening in a light theme, lightening in a dark one. */
  :where([part='add-button']):active:where(:not(:disabled)),
  :where([part='remove-button']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='add-button']:disabled,
  [part='remove-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='add-button']:focus-visible,
  [part='remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='import'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(--lr-size-14rem);
  }
  [part='search'] {
    display: block;
  }
  [part='search-input'] {
    box-sizing: border-box;
    inline-size: 100%;
    -webkit-appearance: none;
    appearance: none;
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='search-input']::placeholder {
    color: var(--lr-color-text-quiet);
    opacity: 1;
  }
  [part='search-input']::-webkit-search-cancel-button,
  [part='search-input']::-webkit-search-decoration {
    -webkit-appearance: none;
    appearance: none;
    display: none;
  }
  [part='search-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: a search field is a caret target, not a push target -- pointer-down places an
     insertion point and hands the affordance to :focus-visible, so a pressed tint would flash for
     one frame before the focus ring contradicted it. */
  :where([part='search-input']):hover:where(:not(:disabled)) {
    border-color: var(--lr-color-brand);
  }
  [part='search-input']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='tag-filter'] {
    display: block;
  }
  [part='grid'] {
    display: block;
    min-inline-size: 0;
  }
`;
