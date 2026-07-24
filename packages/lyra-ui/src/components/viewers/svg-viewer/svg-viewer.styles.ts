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
    --_lr-svg-viewer-highlight-color: var(
      --lr-svg-viewer-highlight-accent-color,
      var(--lr-color-brand)
    );
    position: absolute;
    pointer-events: none;
    border: var(--lr-border-width-thick) solid var(--_lr-svg-viewer-highlight-color);
    border-radius: var(--lr-radius-xs);
  }
  [part='region-highlight-target'] {
    position: absolute;
    z-index: var(--lr-layer-content);
    box-sizing: border-box;
    pointer-events: auto;
    cursor: pointer;
    transform: translate(-50%, -50%);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: 0;
    background: transparent;
  }
  [part='region-highlight']:where([data-tone='success']) {
    --_lr-svg-viewer-highlight-color: var(
      --lr-svg-viewer-highlight-success-color,
      var(--lr-color-success)
    );
  }
  [part='region-highlight']:where([data-tone='warning']) {
    --_lr-svg-viewer-highlight-color: var(
      --lr-svg-viewer-highlight-warning-color,
      var(--lr-color-warning)
    );
  }
  [part='region-highlight']:where([data-tone='danger']) {
    --_lr-svg-viewer-highlight-color: var(
      --lr-svg-viewer-highlight-danger-color,
      var(--lr-color-danger)
    );
  }
  [part='region-highlight']:where([data-tone='neutral']) {
    --_lr-svg-viewer-highlight-color: var(
      --lr-svg-viewer-highlight-neutral-color,
      var(--lr-color-neutral)
    );
  }
  [part='region-highlight-target']:hover + [part='region-highlight'] {
    background: color-mix(in srgb, var(--_lr-svg-viewer-highlight-color) 20%, transparent);
  }
  [part='region-highlight-target']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='region-highlight']:where([data-active]) {
    border-color: var(--lr-svg-viewer-active-border, var(--lr-color-warning, var(--lr-color-brand)));
  }
  [part='highlight-actions'] {
    display: grid;
    gap: var(--lr-space-xs);
    inline-size: 100%;
  }
  [part='region-highlight-action'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    color: var(--lr-color-text);
    background: var(--lr-color-surface);
    cursor: pointer;
  }
  [part='region-highlight-action']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='region-highlight-action']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
