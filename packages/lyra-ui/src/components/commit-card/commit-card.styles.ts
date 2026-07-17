import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    padding: var(--lyra-space-m);
  }
  [part='subject'] {
    font-weight: 600;
  }
  [part='body'] {
    white-space: pre-wrap;
    color: var(--lyra-color-text-quiet);
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
  }
  [part='meta'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
    align-items: center;
    margin-block-start: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='hash'] {
    font-family: var(--lyra-font-mono);
  }
  [part='additions'] {
    color: var(--lyra-color-success);
  }
  [part='deletions'] {
    color: var(--lyra-color-danger);
  }
  [part='files-toggle'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: none;
    border: none;
    color: var(--lyra-color-brand);
    cursor: pointer;
    padding: var(--lyra-space-xs) 0;
  }
  [part='file'] {
    display: flex;
    justify-content: space-between;
    inline-size: 100%;
    background: none;
    border: none;
    font: inherit;
    font-family: var(--lyra-font-mono);
    text-align: start;
    cursor: pointer;
    padding: var(--lyra-space-2xs) 0;
  }
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: none;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    padding: var(--lyra-space-2xs) var(--lyra-space-xs);
    cursor: pointer;
  }
`;
