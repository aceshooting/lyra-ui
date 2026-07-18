import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }

  [part='form-control'] {
    min-inline-size: 0;
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='form-control-label'][hidden],
  [part='country-prefix'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }

  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    inline-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='input-wrapper']:focus-within {
    border-color: var(--lr-color-brand);
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  :host([data-invalid]) [part='input-wrapper'] {
    border-color: var(--lr-color-danger);
  }

  :host([disabled]) [part='input-wrapper'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='country-prefix'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding-inline-start: var(--lr-space-s);
  }

  [part='country-select'] {
    flex: 0 1 auto;
    min-inline-size: var(--lr-size-6rem);
    max-inline-size: 45%;
    align-self: stretch;
    padding-inline: var(--lr-space-s);
    border: none;
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='country-select']:focus,
  [part='input']:focus {
    outline: none;
  }

  [part='calling-code'] {
    flex: 0 0 auto;
    padding-inline-start: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    direction: ltr;
    font-size: var(--lr-font-size-md-sm);
    unicode-bidi: isolate;
  }

  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  [part='input']::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }

  [part='hint'] {
    color: var(--lr-color-text-quiet);
  }

  [part='error'] {
    color: var(--lr-color-danger);
  }

`;
