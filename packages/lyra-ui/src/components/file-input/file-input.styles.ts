import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-l);
    border: var(--lr-border-width-medium) dashed var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    text-align: center;
    cursor: pointer;
    font-size: var(--lr-font-size-md-sm);
  }
  [part='base'][data-drag-state='accept'] {
    border-color: var(--lr-color-success);
    background: color-mix(in srgb, var(--lr-color-success) 8%, transparent);
  }
  [part='base'][data-drag-state='reject'] {
    border-color: var(--lr-color-danger);
    background: color-mix(in srgb, var(--lr-color-danger) 8%, transparent);
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([disabled]) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
`;
