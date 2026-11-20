import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { activeFill, disabledControl, focusRing } from '../../../internal/interactive-control.styles.js';
import { containerHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  [part='input-limit'], [part='slices-limit'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }

  :host { ${containerHost} }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-m); }
  [part='header'] { display: grid; grid-template-columns: auto minmax(var(--lr-size-8rem), 1fr) auto; gap: var(--lr-space-s); align-items: center; }
  [part='activity'] { min-inline-size: 0; }
  [part='status'] { min-inline-size: 0; max-inline-size: 100%; overflow-wrap: break-word; }
  [part='controls'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); }
  [part='controls'] button {
    min-block-size: var(--lr-icon-button-size); padding: var(--lr-space-xs) var(--lr-space-s); border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius); background: var(--lr-color-surface); color: var(--lr-color-text); font: inherit; cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part='controls'] button:hover:where(:not(:disabled)) { background: var(--lr-color-surface-raised); }
  [part='controls'] button:active:where(:not(:disabled)) { background: ${activeFill('var(--lr-color-surface-raised)')}; }
  [part='controls'] button:disabled { ${disabledControl} }
  [part='controls'] button:focus-visible { ${focusRing} }
  [part='error'] { margin: 0; padding: var(--lr-space-s); border-inline-start: var(--lr-border-width-thick) solid var(--lr-color-danger); background: var(--lr-color-danger-quiet); color: var(--lr-color-text); }
  [part='capture'] { align-self: center; }
  [part='transcript'] { min-block-size: var(--lr-size-8rem); min-inline-size: 0; }
  @container ${compactContainerQuery} { [part='header'] { grid-template-columns: 1fr; } [part='controls'] { justify-content: flex-start; } }
`;
