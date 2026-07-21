import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-token-input-min-input-inline-size: var(--lr-size-4rem);
    --lr-token-input-padding: var(--lr-space-xs);
    --lr-token-input-font-size: var(--lr-font-size-md-sm);
    --lr-token-input-control-min-height: var(--lr-size-2-5rem);
    /* --lr-token-input-control-height is intentionally NOT declared here -- same convention as
       lr-input/lr-select/lr-combobox: a consumer-facing exact-height escape hatch consumed only
       through the var() fallback on [part='input-wrapper'] below. */
  }
  :host([size='2xs']) {
    --lr-token-input-padding: var(--lr-size-0-0625rem);
    --lr-token-input-font-size: var(--lr-font-size-2xs);
    --lr-token-input-control-min-height: var(--lr-size-1-25rem);
  }
  :host([size='xs']) {
    --lr-token-input-padding: var(--lr-size-0-125rem);
    --lr-token-input-font-size: var(--lr-font-size-xs);
    --lr-token-input-control-min-height: var(--lr-size-1-5rem);
  }
  :host([size='s']) {
    --lr-token-input-padding: var(--lr-space-xs);
    --lr-token-input-font-size: var(--lr-font-size-sm);
    --lr-token-input-control-min-height: var(--lr-size-1-875rem);
  }
  :host([size='l']) {
    --lr-token-input-padding: var(--lr-space-m);
    --lr-token-input-font-size: var(--lr-font-size-lg);
    --lr-token-input-control-min-height: var(--lr-size-3rem);
  }
  :host([size='xl']) {
    --lr-token-input-padding: var(--lr-space-l);
    --lr-token-input-font-size: var(--lr-font-size-xl);
    --lr-token-input-control-min-height: var(--lr-size-3-5rem);
  }
  [part='form-control'] { display: grid; gap: var(--lr-space-xs); }
  [part='form-control-label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); }
  [part='input-wrapper'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lr-space-xs); min-block-size: var(--lr-token-input-control-height, var(--lr-token-input-control-min-height)); block-size: var(--lr-token-input-control-height, auto); padding: var(--lr-token-input-padding); font-size: var(--lr-token-input-font-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); }
  [part='input-wrapper']:focus-within { border-color: var(--lr-color-brand); outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='input'] { flex: 1 1 var(--lr-token-input-input-inline-size, var(--lr-size-8rem)); min-inline-size: var(--lr-token-input-min-input-inline-size); border: 0; outline: 0; background: transparent; color: var(--lr-color-text); font: inherit; }
  [part='input']::placeholder { color: var(--lr-color-text-quiet); }
  [part='token'] { display: inline-flex; align-items: center; gap: var(--lr-space-2xs); padding: var(--lr-space-2xs) var(--lr-space-xs); border-radius: var(--lr-radius); background: var(--lr-color-brand-quiet); color: var(--lr-color-text); }
  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-swatch-picker's [part='swatch']), while the visible glyph (closeIcon(), rendered at
     1em -- already compact at this control's font size) stays centered inside via flex rather than
     growing itself, so the dense token row keeps its own compact glyph even though the button's own
     hit-target box grows. */
  [part='remove'] { display: inline-flex; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  [part='remove']:hover { background: var(--lr-color-brand-quiet); }
  [part='remove']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  /* Only rendered while [editable] is set, so the non-editable token row keeps its plain,
     non-focusable text span and its exact current metrics. */
  [part='token-label'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border-radius: var(--lr-radius);
    cursor: pointer;
  }
  [part='token-label']:hover { background: var(--lr-color-brand-quiet); }
  [part='token-label']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host(:disabled) [part='token-label'] { cursor: default; }
  [part='token-editor'] { inline-size: var(--lr-token-input-editor-inline-size, var(--lr-size-6rem)); max-inline-size: 100%; border: 0; outline: 0; padding: 0; background: transparent; color: inherit; font: inherit; }
  [part='token-editor']::placeholder { color: var(--lr-color-text-quiet); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='input-wrapper'] { border-color: var(--lr-color-danger); }
  /* :host(:disabled), not :host([disabled]) -- the native FACE pseudo-class also matches an
     ancestor <fieldset disabled> cascade (see effectiveDisabled in token-input.class.ts), which
     the bracket-attribute selector would miss entirely (mirrors lr-select's/lr-combobox's
     identical fix). */
  :host(:disabled) { opacity: var(--lr-opacity-disabled); }
`;
