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
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
  }

  [part='label'] {
    margin-block: 0 var(--lr-space-s);
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='progress'] {
    position: relative;
    box-sizing: border-box;
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }

  [part='progress']::before {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: calc(var(--_progress-value, 0) * 1%);
    background: var(--lr-color-brand-quiet);
    content: '';
  }

  [part='progress-label'] {
    position: relative;
    padding-inline: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }

  [part='list'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    margin: var(--lr-space-s) 0 0;
    padding: 0;
    list-style: none;
  }

  [part='step'] {
    display: grid;
    min-inline-size: 0;
    max-inline-size: 100%;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
    gap: var(--lr-space-s);
    align-items: center;
    padding-block: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }

  [part='step-copy'] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='step-label'] {
    font-weight: var(--lr-font-weight-medium);
    overflow-wrap: anywhere;
  }

  [part='description'],
  [part='sources'],
  [part='status'] {
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }

  [part='empty'],
  [part='limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
`;
