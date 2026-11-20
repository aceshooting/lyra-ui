import { css } from 'lit';
import { activeFill, focusRing } from '../../../internal/interactive-control.styles.js';
import { blockHost } from '../../../internal/layout-fragments.styles.js';
export const styles = css`
  :host { ${blockHost} }
  [part='base'] { display: grid; gap: var(--lr-space-m); min-inline-size: 0; }
  [part='heading'] { margin: 0; font-size: var(--lr-font-size-lg); font-weight: var(--lr-font-weight-bold); overflow-wrap: anywhere; }
  [part='file'] { min-inline-size: 0; overflow: hidden; border: var(--lr-border-width-thin) solid var(--lr-change-review-file-border-color, var(--lr-color-border)); border-radius: var(--lr-change-review-file-radius, var(--lr-radius-container)); }
  [part='file-header'] { min-inline-size: var(--lr-icon-button-size); padding: var(--lr-space-s); min-block-size: var(--lr-icon-button-size); box-sizing: border-box; font-weight: var(--lr-font-weight-semibold); overflow-wrap: anywhere; cursor: pointer; }
  [part='file-header'] { --_lr-change-review-header-hover: var(--lr-change-review-header-hover-bg, var(--lr-color-surface-raised)); }
  [part='file-header']:hover { background: var(--_lr-change-review-header-hover); }
  [part='file-header']:active { background: ${activeFill('var(--_lr-change-review-header-hover)')}; }
  [part='file-header']:focus-visible { ${focusRing} }
  [part='previous-path'] { display: block; color: var(--lr-color-text-quiet); font-weight: var(--lr-font-weight-normal); }
  [part='hunk'] { min-inline-size: 0; padding: var(--lr-space-s); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='hunk-header'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-s); justify-content: space-between; overflow-wrap: anywhere; margin-block-end: var(--lr-space-s); }
  [part='status'], [part='empty'], [part='limit'] { color: var(--lr-color-text-quiet); }
  [part='actions'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); margin-block-start: var(--lr-space-s); }
  [part='file-header'] { transition: background-color var(--lr-transition-fast), border-color var(--lr-transition-fast); }
  @media (prefers-reduced-motion: reduce) { [part='file-header'] { transition: none; } }
`;
