import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='chunk'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-size-2px);
    padding-block: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='chunk'][aria-current='true'] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='score'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
  [part='score-bar'] {
    flex: 1 1 auto;
    max-inline-size: var(--lyra-size-6rem);
    block-size: var(--lyra-size-4px);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-border);
    overflow: hidden;
  }
  [part='score-fill'] {
    display: block;
    block-size: 100%;
    background: var(--lyra-color-text-quiet);
  }
  [part='score-fill'][data-tone='success'] {
    background: var(--lyra-color-success);
  }
  [part='score-fill'][data-tone='warning'] {
    background: var(--lyra-color-warning);
  }
  [part='score-fill'][data-tone='danger'] {
    background: var(--lyra-color-danger);
  }
  [part='open-button'] {
    display: block;
    max-inline-size: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lyra-color-brand);
    font: inherit;
    font-weight: var(--lyra-font-weight-medium);
    text-align: start;
    cursor: pointer;
  }
  [part='title'] {
    font: inherit;
  }
  [part='text'] {
    margin: 0;
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-sm);
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
    color: var(--lyra-color-brand);
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    cursor: pointer;
  }
`;
