import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: 0.875rem;
    font-weight: 600;
  }
  [part='form-control-label']:empty {
    display: none;
  }

  [part='combobox'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    min-block-size: 2.5rem;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    cursor: text;
  }
  [part='combobox']:focus-within {
    border-color: var(--lyra-color-brand);
    outline: 2px solid transparent;
  }
  :host([disabled]) [part='combobox'] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  [part='tag'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: 0.1rem 0.4rem;
    font-size: 0.8125rem;
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-text);
    border-radius: var(--lyra-radius);
  }
  [part='tag__remove-button'] {
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
    line-height: 1;
    font-size: 1rem;
  }

  [part='combobox-input'] {
    flex: 1 1 6ch;
    min-inline-size: 4ch;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='clear-button'],
  [part='expand-icon'] {
    flex: 0 0 auto;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    padding: 0 var(--lyra-space-xs);
    line-height: 1;
  }

  [part='listbox'] {
    display: none;
    position: fixed;
    z-index: 900;
    box-sizing: border-box;
    max-block-size: 18rem;
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: 12rem;
    max-inline-size: min(92vw, 28rem);
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
  }
  :host([open]) [part='listbox'] {
    display: block;
  }

  [part='option'] {
    display: flex;
    flex-direction: column;
    align-items: start;
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid transparent;
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
    font-weight: 600;
  }
  [part='option'][aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .group-label {
    padding: var(--lyra-space-xs) var(--lyra-space-s) 0;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--lyra-color-text-quiet);
  }
  .empty {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='hint']:empty {
    display: none;
  }
`;
