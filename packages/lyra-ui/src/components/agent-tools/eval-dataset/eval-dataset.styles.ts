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
    position: relative;
  }
  [part='search-input'] {
    box-sizing: border-box;
    inline-size: 100%;
    -webkit-appearance: none;
    appearance: none;
    padding-inline-start: var(--lr-space-s);
    padding-inline-end: var(--lr-icon-button-size);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  /* Replaces the native ::-webkit-search-cancel-button suppressed below -- same "opt-out chrome
     needs a rendered replacement" contract lr-input's own [part='clear-button'] documents. */
  [part='search-clear'] {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
  }
  [part='search-clear']:not(:disabled):hover {
    color: var(--lr-color-text);
  }
  [part='search-clear']:not(:disabled):active {
    color: var(--lr-color-text);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='search-clear']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='search-clear']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
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
