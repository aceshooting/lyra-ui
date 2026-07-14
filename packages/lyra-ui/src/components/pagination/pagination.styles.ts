import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    --lyra-pagination-control-size: var(--lyra-size-2-5rem);
    --lyra-pagination-font-size: var(--lyra-font-size-md-sm);
  }
  :host([size='xs']) {
    --lyra-pagination-control-size: var(--lyra-size-1-75rem);
    --lyra-pagination-font-size: var(--lyra-font-size-xs);
  }
  :host([size='s']) {
    --lyra-pagination-control-size: var(--lyra-size-2-25rem);
    --lyra-pagination-font-size: var(--lyra-font-size-sm);
  }
  :host([size='l']) {
    --lyra-pagination-control-size: var(--lyra-size-3rem);
    --lyra-pagination-font-size: var(--lyra-font-size-md);
  }
  :host([size='xl']) {
    --lyra-pagination-control-size: var(--lyra-size-3-5rem);
    --lyra-pagination-font-size: var(--lyra-font-size-lg);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lyra-space-m);
    min-inline-size: 0;
    font-size: var(--lyra-pagination-font-size);
  }
  [part='summary'] {
    min-inline-size: 0;
    color: var(--lyra-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part='controls'] {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-pagination-control-size);
    min-inline-size: var(--lyra-pagination-control-size);
    block-size: var(--lyra-pagination-control-size);
    padding: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='previous-button']:hover:not(:disabled),
  [part='next-button']:hover:not(:disabled) {
    background: var(--lyra-color-brand-quiet);
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible,
  [part='page-input']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled,
  [part='page-input']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='previous-icon'],
  [part='next-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: var(--lyra-line-height-none);
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
    color: var(--lyra-color-text-quiet);
    white-space: nowrap;
  }
  [part='page-input'] {
    box-sizing: border-box;
    inline-size: var(--lyra-pagination-control-size);
    min-inline-size: var(--lyra-pagination-control-size);
    block-size: var(--lyra-pagination-control-size);
    padding: var(--lyra-space-xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    text-align: center;
  }
  [part='page-input'][aria-invalid='true'] {
    border-color: var(--lyra-color-danger);
  }
  [part='live-region'].sr-only {
    position: absolute;
    inline-size: var(--lyra-size-1px);
    block-size: var(--lyra-size-1px);
    padding: 0;
    margin: var(--lyra-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  /* Container-query lengths cannot reference custom properties. This is the
     documented 320px narrow-allocation baseline expressed in root-relative
     units so it still follows the page's type scale. */
  @container (max-width: 20rem) {
    [part='base'] {
      flex-direction: column;
      align-items: stretch;
    }
    [part='controls'] {
      justify-content: space-between;
    }
  }
`;

