import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lyra-notebook-viewer-max-height, none);
    overflow: auto;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
  }
  [part='cell'] {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='cell'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='cell-gutter'] {
    min-inline-size: var(--lyra-size-4rem);
    color: var(--lyra-color-text-quiet);
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-xs);
    text-align: end;
  }
  [part='outputs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    margin-block-start: var(--lyra-space-xs);
  }
  [part='output'] {
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-sm);
    white-space: pre-wrap;
  }
  [part='output'][data-stream='stderr'],
  [part='output'][data-output-type='error'] {
    color: var(--lyra-color-danger);
  }
  [part='output-toggle'] {
    align-self: flex-start;
    border: none;
    background: none;
    color: var(--lyra-color-brand);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  [part='error'] {
    color: var(--lyra-color-danger);
    padding: var(--lyra-space-l);
    text-align: center;
  }
  @media (min-width: 480px) {
    [part='cell-gutter'] {
      display: block;
    }
  }
  @media (max-width: 479px) {
    [part='cell'] {
      grid-template-columns: 1fr;
    }
    [part='cell-gutter'] {
      text-align: start;
    }
  }
`;
