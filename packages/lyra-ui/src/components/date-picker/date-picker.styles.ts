import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    --lyra-cell-size: var(--lyra-size-2-25rem);
  }
  :host([disabled]) {
    opacity: var(--lyra-opacity-disabled);
    pointer-events: none;
  }
  [part='base'] {
    display: flex;
    gap: var(--lyra-space-l);
    padding: var(--lyra-space-s);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lyra-space-s);
    margin-block-end: var(--lyra-space-xs);
  }
  [part='title'] {
    font-weight: var(--lyra-font-weight-semibold);
    font-size: var(--lyra-size-0-9375rem);
  }
  [part='previous'],
  [part='next'] {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text);
    font-size: var(--lyra-size-1-1rem);
    line-height: var(--lyra-line-height-none);
    padding: var(--lyra-space-xs);
    border-radius: var(--lyra-radius);
  }
  [part='previous']:hover,
  [part='next']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='previous'] svg {
    transform: rotate(180deg);
  }
  [part='weekdays'] {
    display: grid;
    grid-template-columns: repeat(7, var(--lyra-cell-size));
  }
  [part='weekday'] {
    text-align: center;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
    padding-block: var(--lyra-space-xs);
  }
  [part='grid'] {
    display: grid;
    grid-template-columns: repeat(7, var(--lyra-cell-size));
  }
  [part='week'] {
    display: contents;
  }
  [part~='day'] {
    inline-size: var(--lyra-cell-size);
    block-size: var(--lyra-cell-size);
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text);
    font: inherit;
    border-radius: var(--lyra-radius);
  }
  [part~='day']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part~='day-outside'] {
    color: var(--lyra-color-text-quiet);
  }
  [part~='day-outside'][part~='day-range-inner'],
  [part~='day-outside'][part~='day-range-inner']:hover {
    color: var(--lyra-color-text);
  }
  [part='day-placeholder'] {
    inline-size: var(--lyra-cell-size);
    block-size: var(--lyra-cell-size);
  }
  [part~='day-today'] {
    outline: var(--lyra-border-width-thin) solid var(--lyra-color-brand);
    outline-offset: var(--lyra-size-neg-1px);
  }
  [part~='day-range-inner'] {
    background: var(--lyra-color-brand-quiet);
    border-radius: 0;
  }
  [part~='day-selected'],
  [part~='day-range-start'],
  [part~='day-range-end'] {
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
  }
  [part~='day']:disabled {
    color: var(--lyra-color-text-quiet);
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part~='day']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
