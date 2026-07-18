import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    --lr-pagination-control-size: var(--lr-size-2-5rem);
    --lr-pagination-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='xs']) {
    --lr-pagination-control-size: var(--lr-size-1-75rem);
    --lr-pagination-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-pagination-control-size: var(--lr-size-2-25rem);
    --lr-pagination-font-size: var(--lr-font-size-sm);
  }
  :host([size='l']) {
    --lr-pagination-control-size: var(--lr-size-3rem);
    --lr-pagination-font-size: var(--lr-font-size-md);
  }
  :host([size='xl']) {
    --lr-pagination-control-size: var(--lr-size-3-5rem);
    --lr-pagination-font-size: var(--lr-font-size-lg);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-m);
    min-inline-size: 0;
    font-size: var(--lr-pagination-font-size);
  }
  [part='summary'] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part='controls'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-pagination-control-size);
    min-inline-size: var(--lr-pagination-control-size);
    block-size: var(--lr-pagination-control-size);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='previous-button']:hover:not(:disabled),
  [part='next-button']:hover:not(:disabled) {
    background: var(--lr-color-brand-quiet);
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible,
  [part='page-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled,
  [part='page-input']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='previous-icon'],
  [part='next-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: var(--lr-line-height-none);
  }
  [part='previous-icon'] {
    transform: rotate(180deg);
  }
  [part='next-icon'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='previous-icon'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next-icon'] {
    transform: rotate(180deg);
  }
  [part='page-field'] {
    display: inline-flex;
    align-items: center;
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  [part='page-input'] {
    box-sizing: border-box;
    inline-size: var(--lr-pagination-control-size);
    min-inline-size: var(--lr-pagination-control-size);
    block-size: var(--lr-pagination-control-size);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: center;
  }
  [part='page-input'][aria-invalid='true'] {
    border-color: var(--lr-color-danger);
  }
  [part='live-region'].sr-only {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  /* Container-query lengths cannot reference custom properties. This is the
     documented 320px narrow-allocation baseline expressed in root-relative
     units so it still follows the page's type scale. */
  @container (max-inline-size: 20rem) {
    [part='base'] {
      flex-direction: column;
      align-items: stretch;
    }
    [part='controls'] {
      justify-content: space-between;
    }
  }
`;

