import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }

  [part='form-control'] {
    min-inline-size: 0;
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='form-control-label'][hidden],
  [part='country-prefix'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }

  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    inline-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='input-wrapper']:focus-within {
    border-color: var(--lr-color-brand);
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  :host([data-invalid]) [part='input-wrapper'] {
    border-color: var(--lr-color-danger);
  }

  :host([disabled]) [part='input-wrapper'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='country-prefix'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding-inline-start: var(--lr-space-s);
  }

  /* The country selector keeps the real native <select> (its popup, keyboard type-ahead, and
     mobile pickers are irreplaceable) but stretches it invisibly over a compact decorative
     trigger, so the closed control never clips a long localized country name and never repeats
     the calling code shown right next to it. */
  [part='country'] {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    flex: 0 0 auto;
    align-self: stretch;
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='country-select'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    appearance: none;
    opacity: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  [part='country-select']:disabled {
    cursor: not-allowed;
  }

  /* The invisible select's popup list is still painted by the browser from these options; without
     an explicit surface/text pairing it falls back to UA colors (a white panel in dark themes). */
  [part='country-select'] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='country-trigger'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    border-start-start-radius: var(--lr-radius);
    border-end-start-radius: var(--lr-radius);
    transition: background-color var(--lr-transition-fast);
  }

  [part='country-select']:not(:disabled):hover + [part='country-trigger'] {
    background: var(--lr-color-brand-quiet);
  }

  /* The wrapper's focus-within ring marks the whole field; this inner ring additionally marks
     that keyboard focus sits on the (invisible) country select rather than the telephone input. */
  [part='country-select']:focus-visible + [part='country-trigger'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='flag'] {
    font-size: var(--lr-font-size-lg);
  }

  [part='country-code'] {
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='country-code'][data-placeholder] {
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-normal);
  }

  [part='expand-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-none);
  }

  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='input']:focus {
    outline: none;
  }

  [part='calling-code'] {
    flex: 0 0 auto;
    padding-inline-start: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    direction: ltr;
    font-size: var(--lr-font-size-md-sm);
    unicode-bidi: isolate;
  }

  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    inline-size: 100%;
    padding: var(--lr-space-s);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  [part='input']::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }

  [part='hint'] {
    color: var(--lr-color-text-quiet);
  }

  [part='error'] {
    color: var(--lr-color-danger);
  }

`;
