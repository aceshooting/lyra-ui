import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
    font-family: var(--lr-font);
    color: var(--lr-color-text);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    min-inline-size: 0;
  }

  [part='meter'] {
    min-inline-size: 0;
  }

  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-xs);
  }

  [part='segments'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }

  [part='segment'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }

  [part='segment-header'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='segment-label'] {
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
    min-inline-size: 0;
  }

  [part='segment-tokens'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
  }

  [part='citation'] {
    margin-inline-start: auto;
  }

  [part='segment-text'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }

  [part='redaction'] {
    background: var(--lr-color-warning-quiet);
    color: var(--lr-color-warning);
    border-radius: var(--lr-radius-xs);
    padding-inline: var(--lr-size-0-125rem);
    font-family: var(--lr-font-mono);
  }

  [part='truncation-boundary'] {
    margin-block-start: var(--lr-space-xs);
    padding-block-start: var(--lr-space-2xs);
    border-block-start: var(--lr-border-width-thin) dashed var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    text-align: start;
  }
`;
