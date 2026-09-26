import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    padding: var(--lr-form-control-padding-block);
    min-block-size: var(--lr-form-control-height);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow-xs);
  }
  :host([frame='plain']) [part='base'] {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
`;
