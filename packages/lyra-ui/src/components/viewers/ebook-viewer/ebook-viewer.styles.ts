import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    box-sizing: border-box;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part="toolbar"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part="mount"] {
    flex: 1 1 auto;
    min-block-size: var(--lr-size-10rem);
    max-block-size: var(--lr-ebook-viewer-max-height, none);
    overflow: hidden;
  }
  [part="mount"] iframe {
    display: block;
    border: none;
  }
  .status-note,
  [part="error"] {
    margin: 0;
    padding: var(--lr-space-l);
    text-align: center;
  }
  .status-note {
    color: var(--lr-color-text-quiet);
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
`;
