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
    margin-block-end: var(--lyra-space-xs);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
  }

  [part='form-control-label'][hidden],
  [part='country-prefix'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }

  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }

  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    inline-size: 100%;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
  }

  [part='input-wrapper']:focus-within {
    border-color: var(--lyra-color-brand);
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  :host([data-invalid]) [part='input-wrapper'] {
    border-color: var(--lyra-color-danger);
  }

  :host([disabled]) [part='input-wrapper'] {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }

  [part='country-prefix'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding-inline-start: var(--lyra-space-s);
  }

  [part='country-select'] {
    flex: 0 1 auto;
    min-inline-size: var(--lyra-size-6rem);
    max-inline-size: 45%;
    align-self: stretch;
    padding-inline: var(--lyra-space-s);
    border: none;
    border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
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
    padding-inline-start: var(--lyra-space-s);
    color: var(--lyra-color-text-quiet);
    direction: ltr;
    font-size: var(--lyra-font-size-md-sm);
    unicode-bidi: isolate;
  }

  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    inline-size: 100%;
    padding: var(--lyra-space-s);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  [part='input']::placeholder {
    color: var(--lyra-color-text-quiet);
  }

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
  }

  [part='hint'] {
    color: var(--lyra-color-text-quiet);
  }

  [part='error'] {
    color: var(--lyra-color-danger);
  }

`;
