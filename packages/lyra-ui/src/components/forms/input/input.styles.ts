import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-input-padding-block: var(--lr-space-s);
    --lr-input-padding-inline: var(--lr-space-s);
    --lr-input-font-size: var(--lr-font-size-md-sm);
    --lr-input-control-min-height: var(--lr-size-2-5rem);
    /* --lr-input-control-height is intentionally NOT declared here. It is a consumer-facing escape
       hatch consumed only through the two var() fallbacks on [part='input-wrapper'] below;
       declaring any value for it (even 'auto') would make those fallback arms unreachable and
       silently turn --lr-input-control-min-height into dead code. Left undeclared, both arms stay
       live: the per-tier floor falls out of the fallback, and setting the property from anywhere
       (inline style, an ancestor, an outer-tree rule) pins an exact height. */
  }
  :host([size='2xs']) {
    --lr-input-padding-block: var(--lr-size-0-0625rem);
    --lr-input-padding-inline: var(--lr-space-2xs);
    --lr-input-font-size: var(--lr-font-size-2xs);
    --lr-input-control-min-height: var(--lr-size-1-25rem);
  }
  :host([size='xs']) {
    --lr-input-padding-block: var(--lr-size-0-125rem);
    --lr-input-padding-inline: var(--lr-space-xs);
    --lr-input-font-size: var(--lr-font-size-xs);
    --lr-input-control-min-height: var(--lr-size-1-5rem);
  }
  :host([size='s']) {
    --lr-input-padding-block: var(--lr-space-xs);
    --lr-input-padding-inline: var(--lr-space-xs);
    --lr-input-font-size: var(--lr-font-size-sm);
    --lr-input-control-min-height: var(--lr-size-1-875rem);
  }
  :host([size='l']) {
    --lr-input-padding-block: var(--lr-space-m);
    --lr-input-padding-inline: var(--lr-space-m);
    --lr-input-font-size: var(--lr-font-size-lg);
    --lr-input-control-min-height: var(--lr-size-3rem);
  }
  :host([size='xl']) {
    --lr-input-padding-block: var(--lr-space-l);
    --lr-input-padding-inline: var(--lr-space-l);
    --lr-input-font-size: var(--lr-font-size-xl);
    --lr-input-control-min-height: var(--lr-size-3-5rem);
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    min-block-size: var(--lr-input-control-height, var(--lr-input-control-min-height));
    /* Pinned only when --lr-input-control-height is set; 'auto' otherwise, so the row keeps
       growing to fit its own content. */
    block-size: var(--lr-input-control-height, auto);
    padding-inline: var(--lr-input-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='input-wrapper']:focus-within {
    border-color: var(--lr-color-brand);
  }
  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    box-sizing: border-box;
    padding-block: var(--lr-input-padding-block);
    border: none;
    outline: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-input-font-size);
  }
  [part='input']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='input'][type='search']::-webkit-search-cancel-button,
  [part='input'][type='search']::-webkit-search-decoration {
    appearance: none;
  }
  [part='input'][type='number'] {
    appearance: textfield;
  }
  [part='input'][type='number']::-webkit-outer-spin-button,
  [part='input'][type='number']::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }
  /* Restyled, not suppressed -- this is the only mouse/touch affordance to open the native time
     picker, unlike the search-cancel/number-spinner glyphs above which this component/lr-pagination
     both already provide their own alternative for. */
  [part='input'][type='time']::-webkit-calendar-picker-indicator {
    cursor: pointer;
    border-radius: var(--lr-radius-xs);
  }
  [part='input']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='start'],
  [part='end'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
  }
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }
  [part='password-toggle'],
  [part='clear-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-md);
  }
  [part='password-toggle']:hover {
    color: var(--lr-color-text);
  }
  [part='clear-button']:hover {
    color: var(--lr-color-text);
  }
  [part='password-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='clear-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
