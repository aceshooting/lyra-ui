import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    --lr-token-input-min-input-inline-size: var(--lr-size-4rem);
    --lr-token-input-padding: var(--lr-space-xs);
    --lr-token-input-font-size: var(--lr-font-size-md-sm);
    --lr-token-input-token-padding: var(--lr-space-2xs) var(--lr-space-xs);
    --lr-token-input-gap: var(--lr-space-xs);
    --lr-token-input-token-gap: var(--lr-space-2xs);
    --lr-token-input-radius: var(--lr-radius);
    /* The row's height floor comes from the ONE shared form-control ladder
       (internal/sizes.styles.ts) rather than a private copy of the same six values, so retuning
       --lr-theme-form-control-height-* moves this control and every sibling field together. That
       ladder matches both spellings of every tier, which is what makes size="small" resolve here
       without a per-component alias rule. */
    --lr-token-input-control-min-height: var(--lr-form-control-height);
    /* --lr-token-input-control-height is intentionally NOT declared here -- same convention as
       lr-input/lr-select/lr-combobox: a consumer-facing exact-height escape hatch consumed only
       through the var() fallback on [part='input-wrapper'] below. */
  }
  :host([pill]) {
    --lr-token-input-radius: var(--lr-radius-pill);
  }
  /* Padding, text size and chip padding stay this component's own ladder: its m tier is denser than
     the shared one (0.25rem of padding and --lr-font-size-md-sm text, against the ladder's 0.75rem
     and --lr-font-size-m), and moving onto the shared values would change the rendered row height at
     l and xl, which this refactor is required to leave alone. Each tier matches both spellings for
     the same reason sizes.styles.ts does -- the height ladder accepts size="small", so a row whose
     padding silently ignored it would be worse than one that never accepted it. */
  :host([size='2xs']) {
    --lr-token-input-padding: var(--lr-size-0-0625rem);
    --lr-token-input-font-size: var(--lr-font-size-2xs);
    --lr-token-input-token-padding: 0 var(--lr-space-2xs);
  }
  :host([size='xs']) {
    --lr-token-input-padding: var(--lr-size-0-125rem);
    --lr-token-input-font-size: var(--lr-font-size-xs);
    --lr-token-input-token-padding: var(--lr-size-1px) var(--lr-space-2xs);
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-token-input-padding: var(--lr-space-xs);
    --lr-token-input-font-size: var(--lr-font-size-sm);
    --lr-token-input-token-padding: var(--lr-space-2xs) var(--lr-space-xs);
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-token-input-padding: var(--lr-space-m);
    --lr-token-input-font-size: var(--lr-font-size-lg);
    --lr-token-input-token-padding: var(--lr-space-xs) var(--lr-space-s);
  }
  :host([size='xl']) {
    --lr-token-input-padding: var(--lr-space-l);
    --lr-token-input-font-size: var(--lr-font-size-xl);
    --lr-token-input-token-padding: var(--lr-space-s) var(--lr-space-m);
  }
  [part='form-control'] { display: grid; min-inline-size: 0; max-inline-size: 100%; gap: var(--lr-token-input-gap); }
  [part='form-control-label'] { color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); }
  [part='input-wrapper'] { display: flex; flex-wrap: wrap; min-inline-size: 0; max-inline-size: 100%; overflow-x: hidden; align-items: center; gap: var(--lr-token-input-gap); min-block-size: var(--lr-token-input-control-height, var(--lr-token-input-control-min-height)); block-size: var(--lr-token-input-control-height, auto); padding: var(--lr-token-input-padding); font-size: var(--lr-token-input-font-size); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-token-input-radius); background: var(--lr-color-surface); }
  [part='input-wrapper']:focus-within { border-color: var(--lr-token-input-focus-border-color, var(--lr-color-brand)); outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='input'] { flex: 1 1 var(--lr-token-input-input-inline-size, var(--lr-size-8rem)); min-inline-size: var(--lr-token-input-min-input-inline-size); border: 0; outline: 0; background: transparent; color: var(--lr-color-text); font: inherit; }
  [part='input']::placeholder { color: var(--lr-color-text-quiet); }
  [part='token'] { display: inline-flex; min-inline-size: 0; max-inline-size: 100%; overflow: hidden; align-items: center; gap: var(--lr-token-input-token-gap); padding: var(--lr-token-input-token-padding); border-radius: var(--lr-token-input-radius); background: var(--lr-token-input-token-bg, var(--lr-color-brand-quiet)); color: var(--lr-color-text); }
  [part='token'] > span:first-child {
    min-inline-size: 0;
  }
  [part='token'] > span:first-child,
  [part='token-label'] {
    overflow: hidden;
    overflow-wrap: anywhere;
    text-overflow: ellipsis;
  }
  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-swatch-picker's [part='swatch']), while the visible glyph (closeIcon(), rendered at
     1em -- already compact at this control's font size) stays centered inside via flex rather than
     growing itself, so the dense token row keeps its own compact glyph even though the button's own
     hit-target box grows. */
  [part='remove'] { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); border: 0; padding: 0; background: transparent; color: inherit; cursor: pointer; }
  [part='remove']:hover { background: var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet)); }
  [part='remove']:active { background: color-mix(in oklab, var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  [part='remove']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  /* Only rendered while [editable] is set, so the non-editable token row keeps its plain,
     non-focusable text span and its exact current metrics. */
  [part='token-label'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border-radius: var(--lr-token-input-radius);
    cursor: pointer;
  }
  [part='token-label']:hover { background: var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet)); }
  [part='token-label']:active { background: color-mix(in oklab, var(--lr-token-input-action-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }
  [part='token-label']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  :host(:disabled) [part='token-label'] { cursor: default; }
  [part='token-editor'] { inline-size: var(--lr-token-input-editor-inline-size, var(--lr-size-6rem)); max-inline-size: 100%; border: 0; outline: 0; padding: 0; background: transparent; color: inherit; font: inherit; }
  [part='token-editor']::placeholder { color: var(--lr-color-text-quiet); }
  [part='hint'], [part='error'] { color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='error'] { color: var(--lr-color-danger); }
  :host([data-invalid]) [part='input-wrapper'] { border-color: var(--lr-token-input-invalid-border-color, var(--lr-color-danger)); }
  /* :host(:disabled), not :host([disabled]) -- the native FACE pseudo-class also matches an
     ancestor <fieldset disabled> cascade (see effectiveDisabled in token-input.class.ts), which
     the bracket-attribute selector would miss entirely (mirrors lr-select's/lr-combobox's
     identical fix). */
  :host(:disabled) { opacity: var(--lr-opacity-disabled); }
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
