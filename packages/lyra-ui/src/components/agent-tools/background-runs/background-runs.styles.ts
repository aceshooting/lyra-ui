import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='base'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    margin: 0;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
  }

  [part='legend'] {
    max-inline-size: 100%;
    padding-inline: var(--lr-space-2xs);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='list'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
  }

  [part='run'] {
    display: grid;
    min-inline-size: 0;
    max-inline-size: 100%;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto) auto;
    gap: var(--lr-space-s);
    align-items: center;
    padding-block: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }

  [part='run-copy'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='label'] {
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }

  [part='description'] {
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='status'] {
    max-inline-size: 100%;
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='actions'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  [part='open'],
  [part='cancel'] {
    --_lr-background-runs-action-hover-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
    --_lr-background-runs-action-active-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding-inline: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }

  [part='open']:not(:disabled):hover,
  [part='cancel']:not(:disabled):hover {
    background: var(--_lr-background-runs-action-hover-bg);
  }

  [part='open']:not(:disabled):active,
  [part='cancel']:not(:disabled):active {
    background: var(--_lr-background-runs-action-active-bg);
  }

  [part='open']:focus-visible,
  [part='cancel']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='open']:disabled,
  [part='cancel']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='empty'],
  [part='limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
`;
