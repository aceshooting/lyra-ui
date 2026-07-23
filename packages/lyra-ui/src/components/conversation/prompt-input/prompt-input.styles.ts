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
    min-inline-size: 0;
  }

  [part='controls'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--lr-space-xs);
  }

  [part='controls'] > * {
    min-inline-size: min(100%, var(--lr-control-width));
    flex: 1 1 var(--lr-control-width);
  }

  [part='sources'] {
    inline-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='sources-summary'] {
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    cursor: pointer;
  }

  [part='sources-summary']:hover {
    color: var(--lr-color-brand);
  }

  [part='sources-summary']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='source-picker'] {
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='chips'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  [part='leading'] {
    display: inline-flex;
  }

  @container (max-inline-size: 319.98px) {
    [part='controls'] {
      flex-direction: column;
    }

    [part='controls'] > * {
      inline-size: 100%;
    }
  }
`;
