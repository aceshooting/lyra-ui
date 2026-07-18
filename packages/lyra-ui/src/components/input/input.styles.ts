import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-input-padding-block: var(--lr-space-s);
    --lr-input-padding-inline: var(--lr-space-s);
    --lr-input-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='2xs']) {
    --lr-input-padding-block: var(--lr-size-0-0625rem);
    --lr-input-padding-inline: var(--lr-space-2xs);
    --lr-input-font-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-input-padding-block: var(--lr-size-0-125rem);
    --lr-input-padding-inline: var(--lr-space-xs);
    --lr-input-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-input-padding-block: var(--lr-space-xs);
    --lr-input-padding-inline: var(--lr-space-xs);
    --lr-input-font-size: var(--lr-font-size-sm);
  }
  :host([size='l']) {
    --lr-input-padding-block: var(--lr-space-m);
    --lr-input-padding-inline: var(--lr-space-m);
    --lr-input-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-input-padding-block: var(--lr-space-l);
    --lr-input-padding-inline: var(--lr-space-l);
    --lr-input-font-size: var(--lr-font-size-xl);
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
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }
  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    inline-size: 100%;
    box-sizing: border-box;
    padding-inline: var(--lr-input-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='input-wrapper']:focus-within {
    border-color: var(--lr-color-brand);
  }
  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    box-sizing: border-box;
    padding-block: var(--lr-input-padding-block);
    border: none;
    outline: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-input-font-size);
  }
  [part='input']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='input']:disabled {
    opacity: var(--lr-opacity-disabled);
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
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-md);
  }
  [part='password-toggle']:hover {
    color: var(--lr-color-text);
  }
  [part='password-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
