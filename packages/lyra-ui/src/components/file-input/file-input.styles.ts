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
    border: 2px dashed var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text-quiet);
    text-align: center;
    cursor: pointer;
    font-size: 0.875rem;
  }
  [part='base'][data-drag-state='accept'] {
    border-color: var(--lyra-color-success);
    background: color-mix(in srgb, var(--lyra-color-success) 8%, transparent);
  }
  [part='base'][data-drag-state='reject'] {
    border-color: var(--lyra-color-danger);
    background: color-mix(in srgb, var(--lyra-color-danger) 8%, transparent);
  }
  :host([disabled]) [part='base'] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  [part='input'] {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    opacity: 0;
    overflow: hidden;
  }
`;
