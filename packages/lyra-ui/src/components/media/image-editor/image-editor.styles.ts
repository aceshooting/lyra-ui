import { css } from 'lit';
import { focusRing } from '../../../internal/interactive-control.styles.js';
import { mediumContainerQuery } from '../../../internal/container-breakpoints.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-32rem);
  }
  [part='base'], [part='controls'], .ranges, label {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='base'] {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    padding: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-container);
    overflow-wrap: anywhere;
  }
  canvas {
    display: block;
    inline-size: 100%;
    max-block-size: var(--lr-size-32rem);
    object-fit: contain;
    background: var(--lr-color-surface-raised);
  }
  label { gap: var(--lr-space-2xs); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); }
  input, select, button {
    box-sizing: border-box;
    max-inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    font: inherit;
    accent-color: var(--lr-color-brand);
  }
  input { inline-size: 100%; margin: 0; }
  select, button {
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding-inline: var(--lr-space-s);
  }
  button:where([aria-pressed='true']) { background: var(--lr-color-brand-quiet); }
  button:hover, select:hover, input:hover { outline: var(--lr-border-width-thin) solid var(--lr-color-border-strong); }
  button:focus-visible, select:focus-visible, input:focus-visible { ${focusRing} }
  .ranges { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @container ${mediumContainerQuery} {
    .ranges { grid-template-columns: minmax(0, 1fr); }
  }
`;
