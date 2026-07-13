import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-l);
  }
  [part='field'] {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--lyra-space-xs);
  }
  [part='label'] {
    display: block;
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }
  /* Applies to a boolean field's slotted <span part="label"> (inside
     <lyra-checkbox>) too -- see tool-param-form.ts's class doc for why that
     span still belongs to *this* component's shadow tree for CSS purposes
     even though it's visually projected into a child element's template. */
  [part='field'][data-required] [part='label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }

  [part='field'] > lyra-select,
  [part='field'] > input.control {
    inline-size: 100%;
  }

  input.control {
    box-sizing: border-box;
    min-block-size: var(--lyra-size-2-5rem);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    font: inherit;
    font-size: var(--lyra-font-size-md);
  }
  input.control:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  input.control[aria-invalid='true'] {
    border-color: var(--lyra-color-danger);
  }
  input.control:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  [part='description'] {
    margin: 0;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='error'] {
    margin: 0;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
  }
  .unsupported {
    margin: 0;
    font-size: var(--lyra-font-size-sm);
    font-style: italic;
    color: var(--lyra-color-text-quiet);
  }
`;
