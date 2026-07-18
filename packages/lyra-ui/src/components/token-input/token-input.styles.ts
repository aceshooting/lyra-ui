import { css } from 'lit';

export const styles = css`
  :host { display: block; --lyra-token-input-min-input-inline-size: var(--lyra-size-4rem); }
  [part='form-control'] { display: grid; gap: var(--lyra-space-xs); }
  [part='form-control-label'] { color: var(--lyra-color-text); font-weight: var(--lyra-font-weight-semibold); }
  [part='input-wrapper'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lyra-space-xs); min-block-size: var(--lyra-size-2-5rem); padding: var(--lyra-space-xs); border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); }
  [part='input-wrapper']:focus-within { border-color: var(--lyra-color-brand); outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color); outline-offset: var(--lyra-focus-ring-offset); }
  [part='input'] { flex: 1 1 var(--lyra-token-input-input-inline-size, var(--lyra-size-8rem)); min-inline-size: var(--lyra-token-input-min-input-inline-size); border: 0; outline: 0; background: transparent; color: var(--lyra-color-text); font: inherit; }
  [part='token'] { display: inline-flex; align-items: center; gap: var(--lyra-space-2xs); padding: var(--lyra-space-2xs) var(--lyra-space-xs); border-radius: var(--lyra-radius); background: var(--lyra-color-brand-quiet); color: var(--lyra-color-text); }
  /* The interactive hit target meets the shared minimum tappable size (same --lyra-icon-button-size
     floor as lyra-swatch-picker's [part='swatch']), while the visible glyph (closeIcon(), rendered at
     1em -- already compact at this control's font size) stays centered inside via flex rather than
     growing itself, so the dense token row keeps its own compact glyph even though the button's own
     hit-target box grows. */
  [part='remove'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lyra-icon-button-size); min-block-size: var(--lyra-icon-button-size); border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  [part='hint'], [part='error'] { color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-sm); }
  [part='error'] { color: var(--lyra-color-danger); }
  :host([data-invalid]) [part='input-wrapper'] { border-color: var(--lyra-color-danger); }
  :host([disabled]) { opacity: var(--lyra-opacity-disabled); }
`;
