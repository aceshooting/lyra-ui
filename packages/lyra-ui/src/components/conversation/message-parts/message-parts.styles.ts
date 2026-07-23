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

  [part~='part'] {
    min-inline-size: 0;
  }

  [part~='part-streaming'] {
    opacity: var(--lr-opacity-muted);
  }

  [part~='tool-call'],
  [part~='citation'],
  [part~='attachment'] {
    align-self: flex-start;
    max-inline-size: 100%;
  }

  [part~='tool-result'],
  [part~='data'] {
    overflow: auto;
  }

  [part~='audio'] {
    inline-size: 100%;
  }

  [part~='audio-transcript'] {
    margin-block: var(--lr-space-xs) 0;
    color: var(--lr-color-text-quiet);
  }

  [part~='error'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-danger);
    border-radius: var(--lr-radius);
    background: var(--lr-color-danger-quiet);
    color: var(--lr-color-danger);
  }

  [part='retry'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }

  @container (max-inline-size: 319.98px) {
    [part='base'] {
      gap: var(--lr-space-xs);
    }
  }
`;
