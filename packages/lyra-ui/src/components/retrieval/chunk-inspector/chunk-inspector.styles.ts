import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='chunk'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    padding-block: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='chunk'][aria-current='true'] {
    background: var(--lr-color-brand-quiet);
  }
  [part='score'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
  [part='score-bar'] {
    flex: 1 1 auto;
    max-inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-4px);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    overflow: hidden;
  }
  [part='score-fill'] {
    display: block;
    block-size: 100%;
    background: var(--lr-color-text-quiet);
  }
  [part='score-fill'][data-tone='success'] {
    background: var(--lr-color-success);
  }
  [part='score-fill'][data-tone='warning'] {
    background: var(--lr-color-warning);
  }
  [part='score-fill'][data-tone='danger'] {
    background: var(--lr-color-danger);
  }
  [part='open-button'] {
    display: block;
    max-inline-size: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    text-align: start;
    cursor: pointer;
  }
  [part='title'] {
    font: inherit;
  }
  [part='text'] {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='text'][data-clamped] {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  [part='toggle'] {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
`;
