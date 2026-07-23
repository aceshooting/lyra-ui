import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }

  [part='heading'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  [part~='item'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='value'] {
    min-inline-size: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  [part='actions'] {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--lr-space-2xs);
  }

  [part~='action'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  [part='empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }

  @container (max-inline-size: 319.98px) {
    [part~='item'] {
      grid-template-columns: minmax(0, 1fr);
    }

    [part='actions'] {
      justify-content: flex-start;
    }
  }
`;
