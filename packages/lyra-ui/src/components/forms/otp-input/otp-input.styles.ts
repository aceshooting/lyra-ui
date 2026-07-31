import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-otp-input-mask-char: '•';
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }
  [part='label'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text);
  }
  [part='label'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }

  /* One real <input> stretched invisibly across the presentational segments. A single field is
     what makes paste, SMS autofill, IME composition and mobile keyboards work without any of it
     being reimplemented -- and it keeps the control to one tab stop, which is what the WAI-ARIA
     text-input pattern expects. */
  [part='field'] {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    inline-size: fit-content;
  }
  [part='control'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    /* Transparent rather than hidden: a hidden input cannot receive focus or show a native
       autofill affordance, and opacity: 0 keeps it a real, focusable text field. */
    color: transparent;
    caret-color: transparent;
    font: inherit;
    letter-spacing: 0;
    opacity: 0;
    cursor: text;
  }
  :host([disabled]) [part='control'] {
    cursor: not-allowed;
  }

  [part~='segment'] {
    display: flex;
    align-items: center;
    justify-content: center;
    /* WCAG 2.5.8: each box is part of one target, but the field as a whole must still clear the
       minimum, and this is the dimension that sets it. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0 var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
    font-variant-numeric: tabular-nums;
    font-size: var(--lr-font-size-lg);
    line-height: var(--lr-line-height-snug);
    transition: border-color var(--lr-transition-fast), box-shadow var(--lr-transition-fast);
  }
  /* State in the part name -- ::part(segment)[data-active] never matches. */
  [part~='active'] {
    border-color: var(--lr-focus-ring-color);
    box-shadow: 0 0 0 var(--lr-focus-ring-width) var(--lr-focus-ring-color);
  }
  [part~='invalid'] {
    border-color: var(--lr-color-danger);
  }
  :host([disabled]) [part~='segment'] {
    opacity: var(--lr-opacity-disabled);
  }

  [part='separator'] {
    color: var(--lr-color-text-quiet);
    user-select: none;
  }

  /* Masking is display-only: the real characters stay in value and in the input the screen
     reader reads, exactly like a password field's dots. */
  [part~='masked']::after {
    content: var(--lr-otp-input-mask-char);
  }
  [part~='placeholder-mask'] {
    color: var(--lr-color-text-quiet);
  }

  [part='hint'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='error'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='segment'] {
      transition: none;
    }
  }
`;
