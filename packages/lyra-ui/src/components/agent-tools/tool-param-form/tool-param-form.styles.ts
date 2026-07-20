import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
  }
  [part='field'] {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--lr-space-xs);
  }
  [part='label'] {
    display: block;
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* Applies to a boolean field's slotted <span part="label"> (inside
     <lr-checkbox>) too -- see tool-param-form.ts's class doc for why that
     span still belongs to *this* component's shadow tree for CSS purposes
     even though it's visually projected into a child element's template. */
  [part='field'][data-required] [part='label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='field'] > lr-select,
  [part='field'] > input.control {
    inline-size: 100%;
  }

  input.control {
    box-sizing: border-box;
    min-block-size: var(--lr-size-2-5rem);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lr-font-size-md);
  }
  input.control {
    appearance: textfield;
  }
  input.control::-webkit-inner-spin-button,
  input.control::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
  input.control:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  input.control[aria-invalid='true'] {
    border-color: var(--lr-color-danger);
  }
  input.control:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='description'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='error'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  .unsupported {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    font-style: italic;
    color: var(--lr-color-text-quiet);
  }
  [part='empty'] {
    margin: 0;
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text-quiet);
  }
`;
