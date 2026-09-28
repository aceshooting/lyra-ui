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
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='list'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='rule'] {
    display: grid;
    min-inline-size: 0;
    max-inline-size: 100%;
    grid-template-columns: minmax(0, 1fr) minmax(var(--lr-size-8rem), auto);
    gap: var(--lr-space-s);
    align-items: center;
    padding-block: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }

  [part='rule-copy'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='rule-label'] {
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }

  [part='description'],
  [part='scope'] {
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='decision'] {
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }

  [part='decision']:where(:not(:disabled)):hover {
    background: var(--lr-color-surface-raised);
  }

  [part='decision']:where(:not(:disabled)):active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part='decision']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='decision']:disabled {
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
