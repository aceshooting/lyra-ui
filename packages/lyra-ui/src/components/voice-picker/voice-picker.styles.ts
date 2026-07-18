import { css } from 'lit';

export const styles = css`
  :host {
    position: relative;
    display: inline-block;
    inline-size: 100%;
    max-inline-size: var(--lyra-size-24rem);
  }
  :host(:disabled) {
    cursor: not-allowed;
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='form-control-label'][hidden] {
    display: none;
  }

  .control-row {
    display: flex;
    align-items: stretch;
    gap: var(--lyra-space-xs);
  }

  [part='trigger'],
  [part='combobox'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: var(--lyra-size-2-5rem);
    box-sizing: border-box;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
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
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([open]) [part='trigger'] {
    border-color: var(--lyra-color-brand);
  }
  :host(:disabled) [part='trigger'],
  :host(:disabled) [part='combobox'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  [part='provider-badge'] {
    flex: 0 0 auto;
    padding-inline-end: var(--lyra-space-xs);
    margin-inline-end: var(--lyra-space-xs);
    border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    font-size: var(--lyra-size-0-6875rem);
    font-weight: var(--lyra-font-weight-bold);
    text-transform: uppercase;
    letter-spacing: var(--lyra-size-0-04em);
    color: var(--lyra-color-text-quiet);
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
    color: var(--lyra-color-text-quiet);
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

  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lyra-color-text-quiet);
    min-inline-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    min-block-size: min(var(--lyra-icon-button-size), var(--lyra-size-1-75rem));
    line-height: var(--lyra-line-height-none);
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='preview-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-size-2-5rem);
    block-size: var(--lyra-size-2-5rem);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  [part='preview-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='preview-button']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='preview-button'][aria-pressed='true'] {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
  }

  [part='listbox'] {
    position: fixed;
    z-index: var(--lyra-layer-dropdown);
    box-sizing: border-box;
    /* Clamped against internal/positioner.js's place()-published available-space custom
       properties (see menu.styles.ts's/combobox.styles.ts's identical [part='listbox']
       treatment) so this popup can't overflow off-screen on a short/keyboard-shrunk viewport. */
    max-block-size: min(var(--lyra-size-18rem), var(--lyra-positioner-available-block-size, var(--lyra-size-18rem)));
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: min(var(--lyra-size-12rem), var(--lyra-positioner-available-inline-size, var(--lyra-size-12rem)));
    max-inline-size: min(92vw, var(--lyra-size-28rem), var(--lyra-positioner-available-inline-size, 100vw));
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lyra-size-neg-0-25rem));
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
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
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid transparent;
    border-radius: var(--lyra-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
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
    font-size: var(--lyra-size-0-6875rem);
    color: var(--lyra-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='option'][data-synthetic] {
    border-style: dashed;
    border-color: var(--lyra-color-border);
  }
  [part='option'][data-synthetic] [part='option-label'] {
    font-style: italic;
  }
  [part='option-badge'] {
    flex: 0 0 auto;
    font-size: var(--lyra-size-0-6875rem);
    font-style: normal;
    font-weight: var(--lyra-font-weight-normal);
    color: var(--lyra-color-text-quiet);
    white-space: nowrap;
  }
  [part='option-preview'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
  }

  [part='empty'] {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }

  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
