import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-svg-viewer-max-height: none;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='body'] {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lyra-size-10rem);
    max-block-size: var(--lyra-svg-viewer-max-height);
    box-sizing: border-box;
    overflow: auto;
    padding: var(--lyra-space-m);
  }
  [part='svg'],
  [part='svg'] svg {
    display: flex;
    max-inline-size: 100%;
    max-block-size: 100%;
  }
  [part='svg'] svg {
    display: block;
  }
  .empty-note,
  [part='error'] {
    margin: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
    text-align: center;
  }
  [part='error'] {
    color: var(--lyra-color-danger);
  }
  [part='spinner'] {
    display: flex;
    justify-content: center;
  }
`;
