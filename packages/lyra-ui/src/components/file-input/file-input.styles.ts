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
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-l);
    border: var(--lyra-border-width-medium) dashed var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text-quiet);
    text-align: center;
    cursor: pointer;
    font-size: var(--lyra-font-size-md-sm);
  }
  [part='base'][data-drag-state='accept'] {
    border-color: var(--lyra-color-success);
    background: color-mix(in srgb, var(--lyra-color-success) 8%, transparent);
  }
  [part='base'][data-drag-state='reject'] {
    border-color: var(--lyra-color-danger);
    background: color-mix(in srgb, var(--lyra-color-danger) 8%, transparent);
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host([disabled]) [part='base'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
`;
