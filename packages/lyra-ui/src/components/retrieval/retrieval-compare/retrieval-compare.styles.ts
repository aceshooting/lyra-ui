import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }
  [part='base'] {
    min-inline-size: 0;
  }
  [part='overlap'] {
    margin: 0 0 var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='sets'] {
    display: grid;
    grid-auto-columns: minmax(var(--lr-size-16rem), 1fr);
    grid-auto-flow: column;
    gap: var(--lr-space-m);
    overflow-x: auto;
    overscroll-behavior-inline: contain;
  }
  [part='set'] {
    min-inline-size: 0;
  }
  [part='set-heading'] {
    margin: 0 0 var(--lr-space-s);
    font-size: var(--lr-font-size-base);
  }
  [part='chunks'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part~='chunk'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--lr-space-xs) var(--lr-space-s);
    inline-size: 100%;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part~='chunk']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part~='chunk']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='chunk-selected'] {
    border-color: var(--lr-color-brand);
  }
  [part='chunk-rank'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part='chunk-title'],
  [part='chunk-text'],
  [part='scores'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='chunk-text'],
  [part='scores'] {
    grid-column: 1 / -1;
  }
  [part='chunk-text'] {
    font-size: var(--lr-font-size-sm);
  }
  [part='scores'] {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--lr-space-2xs) var(--lr-space-s);
  }
  [part='score'] {
    display: flex;
    justify-content: space-between;
    gap: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  @container (max-inline-size: 319.98px) {
    [part='sets'] {
      grid-auto-columns: minmax(var(--lr-size-14rem), 100%);
    }
    [part='scores'] {
      grid-template-columns: 1fr;
    }
  }
`;
