import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Lets the host shrink below its rendered SVG's intrinsic inline size
       inside a narrower flex/grid track (a split pane, dialog, etc.) instead
       of forcing the track to overflow -- [part='body']'s own overflow:auto
       then takes over scrolling within whatever allocation it actually gets. */
    min-inline-size: 0;
    max-inline-size: 100%;
    --lr-svg-viewer-max-height: none;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='body'] {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--lr-size-10rem);
    max-block-size: var(--lr-svg-viewer-max-height);
    box-sizing: border-box;
    overflow: auto;
    padding: var(--lr-space-m);
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
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
  [part='spinner'] {
    display: flex;
    justify-content: center;
  }
  .zoom-content {
    position: relative;
  }
  [part='highlight-layer'] {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  [part='region-highlight'] {
    position: absolute;
    pointer-events: auto;
    border: var(--lr-border-width-thick) solid var(--lr-color-brand);
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
  }
  [part='region-highlight']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='region-highlight']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='region-highlight'][data-active] {
    border-color: var(--lr-svg-viewer-active-border, var(--lr-color-warning, var(--lr-color-brand)));
  }
`;
