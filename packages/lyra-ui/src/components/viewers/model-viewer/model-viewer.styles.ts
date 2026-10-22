import { css } from 'lit';
import { mediumContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-model-viewer-control-fill: var(--lr-color-surface);
    --_lr-model-viewer-control-hover-fill: var(--lr-color-surface-raised);
    --_lr-model-viewer-control-active-fill: color-mix(
      in oklab,
      var(--_lr-model-viewer-control-fill),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='base'] {
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    color: var(--lr-color-text);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    overflow: hidden;
  }
  [part='viewport'] {
    position: relative;
    block-size: var(--lr-model-viewer-height, var(--lr-size-20rem));
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='viewport']:where([data-ready]) {
    cursor: grab;
  }
  [part='viewport'] canvas {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='viewport']:not([data-ready]) canvas {
    visibility: hidden;
  }
  [part='viewport']:where([data-ready]):hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='viewport']:where([data-ready]):active {
    cursor: grabbing;
  }
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring);
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-s);
  }
  [part='control'],
  [part='download'] {
    box-sizing: border-box;
    font: inherit;
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--_lr-model-viewer-control-fill);
    cursor: pointer;
    text-decoration: none;
    transition: var(--lr-transition-interactive);
  }
  [part='control']:where(:not(:disabled)):hover,
  [part='download']:hover {
    background: var(--_lr-model-viewer-control-hover-fill);
  }
  [part='control']:where(:not(:disabled)):active,
  [part='download']:active {
    background: var(--_lr-model-viewer-control-active-fill);
  }
  [part='control']:focus-visible,
  [part='download']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='control']:disabled {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }
  [part='alternative'],
  [part='instructions'],
  [part='status'],
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-s);
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
  [part='footer'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
  }
  [hidden] {
    display: none !important;
  }
  @container ${mediumContainerQuery} {
    [part='toolbar'] > [part='control'] {
      flex: 1 1 auto;
    }
  }
`;
