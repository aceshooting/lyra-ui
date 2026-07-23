import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='frame'] {
    display: block;
    inline-size: 100%;
    border: 0;
    background: var(--lr-color-surface);
  }

  [part='loading'],
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-m);
  }

  [part='loading'] {
    color: var(--lr-color-text-quiet);
  }

  [part='error'] {
    color: var(--lr-color-danger);
    background: var(--lr-color-danger-quiet);
  }

  @container (max-inline-size: 319.98px) {
    [part='loading'],
    [part='error'] {
      padding: var(--lr-space-s);
    }
  }
`;
