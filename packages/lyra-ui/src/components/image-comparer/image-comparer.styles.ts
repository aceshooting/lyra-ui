import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    position: relative;
    isolation: isolate;
    min-inline-size: 0;
    overflow: hidden;
    background: var(--lyra-color-surface-raised);
  }
  [part='before'],
  [part='after'] {
    display: block;
    min-inline-size: 0;
  }
  [part='before'] {
    position: absolute;
    inset: 0;
    z-index: var(--lyra-layer-content);
    clip-path: inset(0 calc(100% - var(--lyra-comparer-position, 50%)) 0 0);
  }
  [part='base'][data-orientation='vertical'] [part='before'] {
    clip-path: inset(0 0 calc(100% - var(--lyra-comparer-position, 50%)) 0);
  }
  [part='before'] ::slotted(*),
  [part='after'] ::slotted(*) {
    display: block;
    inline-size: 100%;
    max-inline-size: 100%;
  }
  [part='divider'] {
    position: absolute;
    z-index: var(--lyra-layer-popover);
    inset-block: 0;
    inset-inline-start: var(--lyra-comparer-position, 50%);
    inline-size: var(--lyra-size-1px);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    pointer-events: none;
  }
  [part='base'][data-orientation='vertical'] [part='divider'] {
    inset-block: auto;
    inset-inline: 0;
    inset-block-start: var(--lyra-comparer-position, 50%);
    inline-size: auto;
    block-size: var(--lyra-size-1px);
  }
  [part='handle'] {
    position: absolute;
    z-index: var(--lyra-layer-tooltip);
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    cursor: ew-resize;
  }
  [part='base'][data-orientation='vertical'] [part='handle'] {
    cursor: ns-resize;
  }
  [part='handle']:focus-visible {
    opacity: 0.01;
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
