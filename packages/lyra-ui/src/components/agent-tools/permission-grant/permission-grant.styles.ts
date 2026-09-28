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
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='legend'] {
    max-inline-size: 100%;
    padding-inline: var(--lr-space-2xs);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='description'] {
    margin-block: var(--lr-space-xs) var(--lr-space-s);
    overflow-wrap: anywhere;
  }

  [part='scope-row'] {
    display: grid;
    min-inline-size: 0;
    max-inline-size: 100%;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr);
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    border-block: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }

  [part='scope-label'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
  }

  [part='scope'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
  }

  [part='status'] {
    margin-block: var(--lr-space-s);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
  }

  [part='actions'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  [part='decision'] {
    --_lr-permission-grant-decision-hover-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
    --_lr-permission-grant-decision-active-bg: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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

  [part='decision']:not(:disabled):hover {
    background: var(--_lr-permission-grant-decision-hover-bg);
  }

  [part='decision']:not(:disabled):active {
    background: var(--_lr-permission-grant-decision-active-bg);
  }

  [part='decision']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='decision']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

`;
