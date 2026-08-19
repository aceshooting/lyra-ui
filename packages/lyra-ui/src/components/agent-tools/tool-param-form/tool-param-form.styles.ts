import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  :host(:disabled) [part='base'] {
    color: var(--lr-color-text-quiet);
  }
  :host(:disabled) [part='field'] {
    cursor: not-allowed;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='field'] {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='label'] {
    display: block;
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* The shared required marker (internal/form-control.styles.ts). The one component where
     "required" is per FIELD, not per host, which is why that sheet carries a second selector on
     [part="field"][data-required] beside the usual :host([required]). Boolean and enum labels
     belong to their nested <lr-select>. */
  ${formControlRequiredMarker}

  [part='field'] > lr-select,
  [part='field'] > input.control {
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
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
    font-size: var(--lr-font-size-m);
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
  input.control:where(:hover):where(:not(:disabled)) {
    border-color: var(--lr-color-brand);
  }
  input.control[aria-invalid='true'] {
    border-color: var(--lr-tool-param-form-invalid-border-color, var(--lr-color-danger));
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
  [part='label'],
  [part='description'],
  [part='error'],
  [part='unsupported'],
  [part='empty'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
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
