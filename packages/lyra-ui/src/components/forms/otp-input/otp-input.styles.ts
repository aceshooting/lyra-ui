import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    --lr-otp-input-mask-char: '•';
    --lr-otp-input-segment-fill: transparent;
    --lr-otp-input-segment-border-color: var(--lr-color-border);
    --lr-otp-input-segment-radius: var(
      --segment-border-radius,
      var(--lr-form-control-radius, var(--lr-radius))
    );
  }
  :host([appearance='filled']) {
    --lr-otp-input-segment-fill: var(--lr-color-surface-raised);
    --lr-otp-input-segment-border-color: transparent;
  }
  :host([appearance='filled-outlined']) {
    --lr-otp-input-segment-fill: var(--lr-color-surface-raised);
    --lr-otp-input-segment-border-color: var(--lr-color-border);
  }
  :host([appearance='contained']) {
    --lr-otp-input-segment-fill: transparent;
    --lr-otp-input-segment-border-color: transparent;
    --lr-otp-input-segment-radius: 0;
  }
  [part~='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part~='label'] {
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
  }
  [part~='label'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  /* One real <input> stretched invisibly across the presentational segments. It remains the native
     integration point for SMS autofill, IME composition, mobile keyboards and selection, while the
     fixed-cell key/paste handlers map editing intents into the visual model. One field also keeps
     the control to one tab stop, which is what the WAI-ARIA text-input pattern expects. */
  [part~='segments'] {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--segment-gap, var(--lr-space-xs));
    inline-size: fit-content;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    box-sizing: border-box;
    overflow-inline: auto;
    overflow-block: hidden;
  }
  :host([appearance='contained']) [part~='segments'] {
    gap: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--segment-border-radius, var(--lr-form-control-radius, var(--lr-radius)));
    background: var(--lr-color-surface-raised);
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
  /* :disabled, not [disabled] -- only the native pseudo-class tracks disablement cascaded from an
     ancestor <fieldset disabled>, which never touches this element's own attribute. */
  :host(:disabled) [part='control'] {
    cursor: not-allowed;
  }

  [part~='segment'] {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex: 0 0 auto;
    inline-size: var(--segment-size, var(--lr-otp-input-segment-size));
    block-size: var(--segment-size, var(--lr-otp-input-segment-size));
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-otp-input-segment-border-color);
    border-radius: var(--lr-otp-input-segment-radius);
    background: var(--lr-otp-input-segment-fill);
    color: var(--lr-color-text);
    font-variant-numeric: tabular-nums;
    font-size: var(--lr-form-control-font-size, var(--lr-font-size-m));
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
  :host(:disabled) [part~='segment'] {
    opacity: var(--lr-opacity-disabled);
  }

  [part~='segment-literal'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    user-select: none;
  }

  /* Masking is display-only: the real characters stay in value and in the input the screen
     reader reads, exactly like a password field's dots. Generated content rather than rendered
     text, so the glyph can never reach an accessible name -- the segment boxes are aria-hidden
     and ::after content is not exposed to assistive technology in the first place.
     The placeholder-mask token is the same glyph in a segment that holds nothing yet, so the
     field reads as a fixed-length code before any entry. */
  [part~='masked']::after,
  [part~='placeholder-mask']::after {
    content: var(--mask-char, var(--lr-otp-input-mask-char));
  }
  /* An unentered glyph is a placeholder, so it sits quieter than an entered character. */
  [part~='placeholder-mask'] {
    color: var(--lr-color-text-quiet);
  }

  [part='hint'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part='error'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='segment'] {
      transition: none;
    }
  }
`;
