import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-l);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-sm);
  }

  [part='field'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-2xs);
  }

  [part='label'] {
    font-weight: var(--lyra-font-weight-semibold);
    color: var(--lyra-color-text);
  }
  [part='label'] span {
    color: var(--lyra-color-danger);
    margin-inline-start: var(--lyra-space-2xs);
  }

  [part='description'] {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
  }

  [part='error'] {
    margin: 0;
    color: var(--lyra-color-danger);
    font-size: var(--lyra-font-size-xs);
  }

  [part='scale'] {
    max-inline-size: var(--lyra-size-32rem);
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    flex-wrap: wrap;
  }

  [part='submit'],
  [part='skip'] {
    font: inherit;
    border-radius: var(--lyra-radius);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    cursor: pointer;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
  }
  [part='submit'] {
    background: var(--lyra-color-brand);
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-surface);
  }
  [part='submit']:disabled,
  [part='skip']:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  [part='submit']:focus-visible,
  [part='skip']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='empty'] {
    color: var(--lyra-color-text-quiet);
  }

  [part='unsupported'] {
    margin: 0;
    color: var(--lyra-color-danger);
    font-size: var(--lyra-font-size-xs);
  }
`;
