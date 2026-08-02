import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    --_lr-split-panel-effective-divider-width: var(
      --lr-split-panel-divider-width,
      var(--divider-width, var(--lr-size-4px))
    );
    --_lr-split-panel-effective-divider-hit-area: var(
      --lr-split-panel-divider-hit-area,
      var(--divider-hit-area, var(--lr-space-m))
    );
    --_lr-split-panel-effective-min: var(--lr-split-panel-min, var(--min, 0%));
    --_lr-split-panel-effective-max: var(--lr-split-panel-max, var(--max, 100%));
    --_lr-split-panel-divider-hit-slop: calc(
      (
          var(--_lr-split-panel-effective-divider-width) -
            max(var(--lr-icon-button-size), var(--_lr-split-panel-effective-divider-hit-area))
        ) / 2
    );
  }

  [part~='base'] {
    position: relative;
    display: grid;
    grid-template-columns:
      minmax(0, var(--_lr-split-panel-start-position))
      minmax(0, calc(100% - var(--_lr-split-panel-start-position)));
    grid-template-rows: minmax(0, 1fr);
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
  }

  [part~='base'][data-orientation='vertical'] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows:
      minmax(0, var(--_lr-split-panel-start-position))
      minmax(0, calc(100% - var(--_lr-split-panel-start-position)));
  }

  [part~='panel'] {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  [part~='start'] {
    grid-column: 1;
    grid-row: 1;
  }

  [part~='end'] {
    grid-column: 2;
    grid-row: 1;
  }

  [part~='base'][data-orientation='vertical'] [part~='end'] {
    grid-column: 1;
    grid-row: 2;
  }

  ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  [part~='divider'] {
    position: absolute;
    inset-block: 0;
    inset-inline-start: var(--_lr-split-panel-start-position);
    z-index: var(--lr-layer-content);
    display: grid;
    place-items: center;
    inline-size: var(--_lr-split-panel-effective-divider-width);
    min-inline-size: var(--_lr-split-panel-effective-divider-width);
    block-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    margin-inline-start: calc(var(--_lr-split-panel-effective-divider-width) / -2);
    background: var(--lr-color-border);
    color: var(--lr-color-text);
    cursor: col-resize;
    touch-action: none;
    user-select: none;
  }

  /* Transparent hit slop preserves the visible divider width while maintaining Lyra's minimum
     interactive target. Generated content belongs to the divider's own hit-test box. */
  [part~='divider']::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: var(--_lr-split-panel-divider-hit-slop);
  }

  [part~='base'][data-orientation='vertical'] [part~='divider'] {
    inset-block-start: var(--_lr-split-panel-start-position);
    inset-block-end: auto;
    inset-inline: 0;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    block-size: var(--_lr-split-panel-effective-divider-width);
    min-block-size: var(--_lr-split-panel-effective-divider-width);
    margin-block-start: calc(var(--_lr-split-panel-effective-divider-width) / -2);
    margin-inline-start: 0;
    cursor: row-resize;
  }

  [part~='base'][data-orientation='vertical'] [part~='divider']::before {
    inset-block: var(--_lr-split-panel-divider-hit-slop);
    inset-inline: 0;
  }

  [part~='divider']:where(:hover) {
    background: var(--lr-color-brand);
  }

  [part~='divider']:where(:active, [data-dragging]) {
    background: var(--lr-color-border-strong);
  }

  [part~='divider']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~='divider']:where([aria-disabled='true']) {
    pointer-events: none;
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }

  .constraint-box {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-base);
    visibility: hidden;
    pointer-events: none;
  }

  .constraint-min,
  .constraint-max {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    block-size: 0;
  }

  .constraint-min {
    inline-size: var(--_lr-split-panel-effective-min);
  }

  .constraint-max {
    inline-size: var(--_lr-split-panel-effective-max);
  }

  [part~='base'][data-orientation='vertical'] .constraint-min,
  [part~='base'][data-orientation='vertical'] .constraint-max {
    inline-size: 0;
  }

  [part~='base'][data-orientation='vertical'] .constraint-min {
    block-size: var(--_lr-split-panel-effective-min);
  }

  [part~='base'][data-orientation='vertical'] .constraint-max {
    block-size: var(--_lr-split-panel-effective-max);
  }
`;
