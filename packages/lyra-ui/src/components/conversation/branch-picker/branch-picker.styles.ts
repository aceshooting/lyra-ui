import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='previous-button'],
  [part='next-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-size-1-5rem);
    block-size: var(--lr-size-1-5rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  /* :where() zeroes the wrapped selectors' specificity contribution, leaving only :hover itself --
     (0,1,0) total, functionally identical selection to [part='previous-button']:hover:not(:disabled)
     ((0,3,0)) but now losing (on the pseudo-element tiebreak) to a consumer's own
     ::part(previous-button):hover override ((0,1,1)) without that consumer needing !important. */
  :where([part='previous-button']):hover:where(:not(:disabled)),
  :where([part='next-button']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='previous-button']:focus-visible,
  [part='next-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='previous-button']:disabled,
  [part='next-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='previous-glyph'],
  [part='next-glyph'] {
    display: inline-flex;
    line-height: var(--lr-line-height-none);
  }
  [part='previous-glyph'] {
    transform: rotate(180deg);
  }
  [part='next-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='previous-glyph'] {
    transform: rotate(0deg);
  }
  :host(:dir(rtl)) [part='next-glyph'] {
    transform: rotate(180deg);
  }
  [part='position'] {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
`;
