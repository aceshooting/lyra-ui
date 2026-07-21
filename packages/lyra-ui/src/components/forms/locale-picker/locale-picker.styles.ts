import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-locale-picker-trigger-padding: var(--lr-space-xs) var(--lr-space-s);
    --lr-locale-picker-trigger-min-height: var(--lr-size-2-5rem);
    --lr-locale-picker-font-size: var(--lr-font-size-md);
    --lr-locale-picker-expand-size: var(--lr-size-1-75rem);
    /* --lr-locale-picker-trigger-height is intentionally NOT declared here -- see lr-select's
       identical convention: it is a consumer-facing escape hatch consumed only through the
       var() fallback on [part='trigger'] below, so leaving it genuinely undeclared keeps that
       fallback arm live. */
  }
  :host([size='2xs']) {
    --lr-locale-picker-trigger-padding: var(--lr-size-0-0625rem) var(--lr-space-2xs);
    --lr-locale-picker-trigger-min-height: var(--lr-size-1-25rem);
    --lr-locale-picker-font-size: var(--lr-font-size-2xs);
    --lr-locale-picker-expand-size: var(--lr-size-1rem);
  }
  :host([size='xs']) {
    --lr-locale-picker-trigger-padding: var(--lr-size-0-125rem) var(--lr-space-xs);
    --lr-locale-picker-trigger-min-height: var(--lr-size-1-5rem);
    --lr-locale-picker-font-size: var(--lr-font-size-xs);
    --lr-locale-picker-expand-size: var(--lr-size-1rem);
  }
  :host([size='s']) {
    --lr-locale-picker-trigger-padding: var(--lr-space-xs) var(--lr-space-xs);
    --lr-locale-picker-trigger-min-height: var(--lr-size-1-875rem);
    --lr-locale-picker-font-size: var(--lr-font-size-sm);
    --lr-locale-picker-expand-size: var(--lr-size-1-25rem);
  }
  :host([size='l']) {
    --lr-locale-picker-trigger-padding: var(--lr-space-s) var(--lr-space-m);
    --lr-locale-picker-trigger-min-height: var(--lr-size-3rem);
    --lr-locale-picker-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-locale-picker-trigger-padding: var(--lr-space-m) var(--lr-space-l);
    --lr-locale-picker-trigger-min-height: var(--lr-size-3-5rem);
    --lr-locale-picker-font-size: var(--lr-font-size-xl);
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal <slot> child element
     regardless of assigned content -- so real emptiness is tracked via hasLabelSlot/label.length
     and reflected via the hidden attribute instead (same fix as lr-select's identical part). */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='trigger'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    min-block-size: var(--lr-locale-picker-trigger-height, var(--lr-locale-picker-trigger-min-height));
    box-sizing: border-box;
    block-size: var(--lr-locale-picker-trigger-height, auto);
    padding: var(--lr-locale-picker-trigger-padding);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lr-locale-picker-font-size);
    text-align: start;
    cursor: pointer;
  }
  [part='trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, keeping this at (0,1,0) --
     matches lr-select's/lr-model-select's fixed convention, so a consumer's own
     ::part(trigger):hover override ((0,1,1)) still wins without needing !important. */
  :where([part='trigger']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lr-color-brand);
  }
  :host(:disabled) [part='trigger'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-locale-picker-expand-size));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-locale-picker-expand-size));
    line-height: var(--lr-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-block-size: var(--lr-size-18rem);
    overflow-y: auto;
    overflow-x: hidden;
    inline-size: max-content;
    min-inline-size: var(--lr-size-12rem);
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem));
    padding: var(--lr-space-xs);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility var(--lr-transition-fast);
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='listbox'] {
      transition: none !important;
    }
  }

  [part='option'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lr-locale-picker-option-active-bg, var(--lr-color-brand-quiet));
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='option-flag'] {
    flex: 0 0 auto;
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
  }
  [part='option-label'] span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option-tag'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }

  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
