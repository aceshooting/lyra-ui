import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
  }
  [part='section'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='section-header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-xs);
  }
  [part='heading'] {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='section-empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='item'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='item-row'] {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='item-text'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-6ch);
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='confidence'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-medium);
  }
  [part='confidence'][data-tone='success'] {
    color: var(--lr-color-success);
  }
  [part='confidence'][data-tone='warning'] {
    color: var(--lr-color-warning);
  }
  [part='confidence'][data-tone='danger'] {
    color: var(--lr-color-danger);
  }
  [part='expand-toggle'] {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part='expand-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='item-body'] {
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='item-body'][hidden] {
    display: none;
  }
  [part='item-actions'] {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--lr-space-xs);
  }
  [part='item-actions'] lr-confirm-bar {
    inline-size: 100%;
  }
  [part='add-button'],
  [part='remove-button'],
  [part='forget-all-button'] {
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part='add-button']:focus-visible,
  [part='remove-button']:focus-visible,
  [part='forget-all-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='forget-all-button'] {
    color: var(--lr-color-danger);
    border-color: var(--lr-color-danger);
  }
`;
