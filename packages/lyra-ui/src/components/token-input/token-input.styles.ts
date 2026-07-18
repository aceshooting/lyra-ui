import { css } from 'lit';

export const styles = css`
  :host { display: block; --lr-token-input-min-input-inline-size: var(--lr-size-4rem); }
  [part='form-control'] { display: grid; gap: var(--lr-space-xs); }
  [part='form-control-label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); }
  [part='input-wrapper'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lr-space-xs); min-block-size: var(--lr-size-2-5rem); padding: var(--lr-space-xs); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); }
  [part='input-wrapper']:focus-within { border-color: var(--lr-color-brand); outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='input'] { flex: 1 1 var(--lr-token-input-input-inline-size, var(--lr-size-8rem)); min-inline-size: var(--lr-token-input-min-input-inline-size); border: 0; outline: 0; background: transparent; color: var(--lr-color-text); font: inherit; }
  [part='token'] { display: inline-flex; align-items: center; gap: var(--lr-space-2xs); padding: var(--lr-space-2xs) var(--lr-space-xs); border-radius: var(--lr-radius); background: var(--lr-color-brand-quiet); color: var(--lr-color-text); }
  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-swatch-picker's [part='swatch']), while the visible glyph (closeIcon(), rendered at
     1em -- already compact at this control's font size) stays centered inside via flex rather than
     growing itself, so the dense token row keeps its own compact glyph even though the button's own
     hit-target box grows. */
  [part='remove'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='input-wrapper'] { border-color: var(--lr-color-danger); }
  :host([disabled]) { opacity: var(--lr-opacity-disabled); }
`;
