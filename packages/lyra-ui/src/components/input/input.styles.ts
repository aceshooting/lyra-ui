import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-input-padding-block: var(--lyra-space-s);
    --lyra-input-padding-inline: var(--lyra-space-s);
    --lyra-input-font-size: var(--lyra-font-size-md-sm);
  }
  :host([size='2xs']) {
    --lyra-input-padding-block: var(--lyra-size-0-0625rem);
    --lyra-input-padding-inline: var(--lyra-space-2xs);
    --lyra-input-font-size: var(--lyra-font-size-2xs);
  }
  :host([size='xs']) {
    --lyra-input-padding-block: var(--lyra-size-0-125rem);
    --lyra-input-padding-inline: var(--lyra-space-xs);
    --lyra-input-font-size: var(--lyra-font-size-xs);
  }
  :host([size='s']) {
    --lyra-input-padding-block: var(--lyra-space-xs);
    --lyra-input-padding-inline: var(--lyra-space-xs);
    --lyra-input-font-size: var(--lyra-font-size-sm);
  }
  :host([size='l']) {
    --lyra-input-padding-block: var(--lyra-space-m);
    --lyra-input-padding-inline: var(--lyra-space-m);
    --lyra-input-font-size: var(--lyra-font-size-lg);
  }
  :host([size='xl']) {
    --lyra-input-padding-block: var(--lyra-space-l);
    --lyra-input-padding-inline: var(--lyra-space-l);
    --lyra-input-font-size: var(--lyra-font-size-xl);
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
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding-inline: var(--lyra-input-padding-inline);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
  }
  [part='input-wrapper']:focus-within {
    border-color: var(--lyra-color-brand);
  }
  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    box-sizing: border-box;
    padding-block: var(--lyra-input-padding-block);
    border: none;
    outline: none;
    background: transparent;
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-input-font-size);
  }
  [part='input']::placeholder {
    color: var(--lyra-color-text-quiet);
  }
  [part='input']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='password-toggle'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    padding: var(--lyra-space-xs);
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    line-height: var(--lyra-line-height-none);
    font-size: var(--lyra-font-size-md);
  }
  [part='password-toggle']:hover {
    color: var(--lyra-color-text);
  }
  [part='password-toggle']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
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
