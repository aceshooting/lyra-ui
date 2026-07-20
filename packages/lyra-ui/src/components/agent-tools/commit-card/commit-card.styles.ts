import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-m);
  }
  [part='subject'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='body'] {
    white-space: pre-wrap;
    color: var(--lr-color-text-quiet);
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }
  [part='meta'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    align-items: center;
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='hash'] {
    font-family: var(--lr-font-mono);
  }
  [part='additions'] {
    color: var(--lr-color-success);
  }
  [part='deletions'] {
    color: var(--lr-color-danger);
  }
  [part='files-toggle'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: none;
    color: var(--lr-color-brand);
    cursor: pointer;
    padding: var(--lr-space-xs) 0;
  }
  [part='files-toggle']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='file'] {
    display: flex;
    justify-content: space-between;
    inline-size: 100%;
    background: none;
    border: none;
    font: inherit;
    font-family: var(--lr-font-mono);
    text-align: start;
    cursor: pointer;
    padding: var(--lr-space-2xs) 0;
  }
  [part='file']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
`;
