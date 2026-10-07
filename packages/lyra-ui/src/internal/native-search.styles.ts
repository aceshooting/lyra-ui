import { css } from 'lit';
import { iconHitTarget, focusRing } from './interactive-control.styles.js';
import { iconAction, iconActionHover, iconActionActive } from './icon-action.styles.js';

/** Filter fields share input theme hooks without registering a form control. */
export const nativeSearchStyles = css`
  .native-search-input {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--_search-height);
    padding-block: var(--_search-padding-block);
    padding-inline-start: var(--_search-padding-inline);
    padding-inline-end: var(--_search-end-padding);
    border: var(--lr-border-width-thin) solid var(--lr-input-border-color, var(--lr-color-border));
    border-radius: var(--_search-radius);
    background: var(--lr-input-fill, var(--lr-color-surface));
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--_search-font-size);
    appearance: none;
    -webkit-appearance: none;
    transition: border-color var(--lr-transition-fast);
  }
  /* no-pressed-state: text-field presses position the caret. */
  .native-search-input:hover:where(:not(:disabled)) {
    border-color: var(--lr-input-focus-border-color, var(--lr-color-border-strong));
  }
  .native-search-input:focus-visible { ${focusRing} }
  .native-search-input::placeholder {
    color: var(--lr-input-placeholder-color, var(--lr-input-action-color, var(--lr-color-text-quiet)));
    opacity: 1;
  }
  .native-search-input::-webkit-search-cancel-button,
  .native-search-input::-webkit-search-decoration {
    appearance: none;
    -webkit-appearance: none;
    display: none;
  }
  [part='search-clear'] {
    position: absolute;
    inset-inline-end: var(--lr-space-2xs);
    inset-block-start: 50%;
    translate: 0 -50%;
    --_lr-icon-button-color-default: var(--lr-input-action-color, var(--lr-color-text-quiet));
    --_lr-icon-button-color-hover-default: var(--lr-input-action-hover-color, var(--lr-color-text));
    ${iconHitTarget}
    ${iconAction}
  }
  [part='search-clear']:hover:where(:not(:disabled)) { ${iconActionHover} }
  [part='search-clear']:active:where(:not(:disabled)) { ${iconActionActive} }
  [part='search-clear']:focus-visible { ${focusRing} }
  .native-search-input:disabled, [part='search-clear']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
`;
