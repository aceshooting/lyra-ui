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
  /* Keep state qualifiers low-specificity so sibling rules remain easy to compose. */
  :where([part='previous-button']):hover:where(:not(:disabled)),
  :where([part='next-button']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  /* Pressed: the hover's brand-quiet fill pushed a further step toward the text color, so the
     press reads as an escalation of the hover tint, not a second unrelated color. */
  :where([part='previous-button']):active:where(:not(:disabled)),
  :where([part='next-button']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
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
