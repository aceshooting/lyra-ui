import { css } from 'lit';

export const styles = css`
  :host {
    position: relative;
    display: inline-block;
    inline-size: 100%;
    max-inline-size: var(--lr-size-24rem);
  }
  :host(:disabled) {
    cursor: not-allowed;
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

  .control-row {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-xs);
  }

  [part='trigger'],
  [part='combobox'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: var(--lr-size-2-5rem);
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
  }
  [part='trigger'] {
    cursor: pointer;
    text-align: start;
  }
  [part='combobox'] {
    cursor: text;
  }
  [part='trigger']:focus-visible,
  [part='combobox']:focus-within {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lr-color-brand);
  }
  :host(:disabled) [part='trigger'],
  :host(:disabled) [part='combobox'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='provider-badge'] {
    flex: 0 0 auto;
    padding-inline-end: var(--lr-space-xs);
    margin-inline-end: var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    font-size: var(--lr-size-0-6875rem);
    font-weight: var(--lr-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-04em);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }

  .trigger-label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-label[data-placeholder] {
    color: var(--lr-color-text-quiet);
  }

  [part='combobox-input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='combobox-input']::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    min-inline-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    min-block-size: min(var(--lr-icon-button-size), var(--lr-size-1-75rem));
    line-height: var(--lr-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='preview-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-2-5rem);
    block-size: var(--lr-size-2-5rem);
    /* Already exactly the shared floor via inline-size/block-size above (--lr-size-2-5rem
       == --lr-icon-button-size == 40px) -- min-inline-size/min-block-size are added
       alongside so a later, more specific override can never shrink this box below that
       floor, matching every other icon-button-shaped part in this library. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='preview-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='preview-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='preview-button'][aria-pressed='true'] {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    /* Clamped against internal/positioner.js's place()-published available-space custom
       properties (see menu.styles.ts's/combobox.styles.ts's identical [part='listbox']
       treatment) so this popup can't overflow off-screen on a short/keyboard-shrunk viewport. */
    max-block-size: min(var(--lr-size-18rem), var(--lr-positioner-available-block-size, var(--lr-size-18rem)));
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: min(var(--lr-size-12rem), var(--lr-positioner-available-inline-size, var(--lr-size-12rem)));
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-28rem), var(--lr-positioner-available-inline-size, 100vw));
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
    background: var(--lr-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='option-label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  [part='option-label'] > :first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option-meta'] {
    font-size: var(--lr-size-0-6875rem);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option'][data-synthetic] {
    border-style: dashed;
    border-color: var(--lr-color-border);
  }
  [part='option'][data-synthetic] [part='option-label'] {
    font-style: italic;
  }
  [part='option-badge'] {
    flex: 0 0 auto;
    font-size: var(--lr-size-0-6875rem);
    font-style: normal;
    font-weight: var(--lr-font-weight-normal);
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part='option-preview'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }

  [part='empty'] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
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
