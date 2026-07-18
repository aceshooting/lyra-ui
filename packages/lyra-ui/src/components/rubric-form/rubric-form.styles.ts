import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }

  [part='field'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='label'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='label'] span {
    color: var(--lr-color-danger);
    margin-inline-start: var(--lr-space-2xs);
  }

  [part='description'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }

  [part='error'] {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-xs);
  }

  [part='scale'] {
    max-inline-size: var(--lr-size-32rem);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    flex-wrap: wrap;
  }

  [part='submit'],
  [part='skip'] {
    font: inherit;
    border-radius: var(--lr-radius);
    padding: var(--lr-space-xs) var(--lr-space-m);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='submit'] {
    background: var(--lr-color-brand);
    border-color: var(--lr-color-brand);
    color: var(--lr-color-surface);
  }
  [part='submit']:disabled,
  [part='skip']:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  [part='submit']:focus-visible,
  [part='skip']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='empty'] {
    color: var(--lr-color-text-quiet);
  }

  [part='unsupported'] {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-xs);
  }
`;
