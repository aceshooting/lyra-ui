import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: var(--lr-flow-minimap-inline-size, var(--lr-size-12rem));
    block-size: var(--lr-flow-minimap-block-size, var(--lr-size-8rem));
  }
  [part='base'] {
    inline-size: 100%;
    block-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='map'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    cursor: pointer;
  }
  [part='node'] {
    fill: var(--lr-color-border-strong);
  }
  [part='node'][data-status='running'] {
    fill: var(--lr-color-brand);
  }
  [part='node'][data-status='success'] {
    fill: var(--lr-color-success);
  }
  [part='node'][data-status='error'] {
    fill: var(--lr-color-danger);
  }
  [part='node'][data-status='denied'] {
    fill: var(--lr-color-warning);
  }
  [part='viewport'] {
    fill: color-mix(in srgb, var(--lr-color-brand) 15%, transparent);
    stroke: var(--lr-color-brand);
    stroke-width: 2;
    cursor: grab;
  }
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
