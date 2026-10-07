import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part="header"],
  [part="notice"],
  [part="nav"] {
    padding: var(--lr-space-s) var(--lr-space-m);
  }
  [part="header"] {
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="header"][hidden],
  [part="nav"][hidden] {
    display: none;
  }
  [part="notice"] {
    margin: 0;
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-sm);
  }
  [part="nav"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }
  [part="previous-button"],
  [part="next-button"] {
    inline-size: var(--lr-size-2rem);
    block-size: var(--lr-size-2rem);
  }
  [part="slide-count"] {
    min-inline-size: 0;
    overflow: hidden;
    color: var(--lr-color-text-quiet);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="container"] {
    min-block-size: var(--lr-size-10rem);
    max-block-size: var(--lr-pptx-viewer-max-height, none);
    overflow: auto;
    position: relative;
  }
  [part="error"] {
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
  }
`;
