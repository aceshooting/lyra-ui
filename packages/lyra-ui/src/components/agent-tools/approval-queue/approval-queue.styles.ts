import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }

  [part='heading-row'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    align-items: baseline;
    justify-content: space-between;
  }

  [part='heading'] {
    margin: 0;
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='count'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='request'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--lr-space-xs);
    align-items: center;
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  [part='request']:hover {
    background: var(--lr-color-surface-raised);
  }

  [part='request']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='request'][data-selected='true'] {
    border-color: var(--lr-color-brand);
  }

  [part='request-info'] {
    min-inline-size: 0;
  }

  [part='tool-name'] {
    display: block;
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }

  [part='request-id'] {
    display: block;
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-xs);
    overflow-wrap: anywhere;
  }

  [part='empty'] {
    color: var(--lr-color-text-quiet);
  }

  @container (max-inline-size: 319.98px) {
    [part='request'] {
      grid-template-columns: 1fr;
    }
  }
`;
