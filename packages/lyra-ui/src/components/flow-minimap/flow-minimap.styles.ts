import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: var(--lyra-flow-minimap-inline-size, var(--lyra-size-12rem));
    block-size: var(--lyra-flow-minimap-block-size, var(--lyra-size-8rem));
  }
  [part='base'] {
    inline-size: 100%;
    block-size: 100%;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    overflow: hidden;
  }
  [part='map'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    cursor: pointer;
  }
  [part='node'] {
    fill: var(--lyra-color-border-strong);
  }
  [part='node'][data-status='running'] {
    fill: var(--lyra-color-brand);
  }
  [part='node'][data-status='success'] {
    fill: var(--lyra-color-success);
  }
  [part='node'][data-status='error'] {
    fill: var(--lyra-color-danger);
  }
  [part='node'][data-status='denied'] {
    fill: var(--lyra-color-warning);
  }
  [part='viewport'] {
    fill: color-mix(in srgb, var(--lyra-color-brand) 15%, transparent);
    stroke: var(--lyra-color-brand);
    stroke-width: 2;
    cursor: grab;
  }
  [part='viewport']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
