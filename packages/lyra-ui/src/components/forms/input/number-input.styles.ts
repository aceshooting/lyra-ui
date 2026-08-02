import { css } from 'lit';

/**
 * `<lr-number-input>`'s own stepper pair, layered on top of the shared `input.styles.ts` sheet.
 *
 * The two buttons sit side by side rather than stacked like the platform's spin buttons: each is
 * an independently-clickable target and therefore carries the library's `--lr-icon-button-size`
 * hit-area floor in both axes, which a stacked pair could only satisfy by doubling the control
 * row's height.
 */
export const styles = css`
  [part~='stepper-down'],
  [part~='stepper-up'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    /* Invisible while the background is none; it exists so the pressed fill below (and the focus
       ring, which follows the same corner) is a rounded chip rather than a hard rectangle. */
    border-radius: var(--lr-radius);
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-input-font-size);
  }
  [part~='stepper-down']:hover,
  [part~='stepper-up']:hover {
    color: var(--lr-color-text);
  }
  /* Pressed. A stepper is the one control here a user holds down and repeats, so the press state
     doing more than the hover is not decoration: it is the only confirmation that the auto-repeat
     is running. Same quiet-to-full text step as the hover, plus a fill mixing the page surface
     toward --lr-color-mix-partner at the stronger active share. */
  [part~='stepper-down']:active,
  [part~='stepper-up']:active {
    color: var(--lr-color-text);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part~='stepper-down']:focus-visible,
  [part~='stepper-up']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='stepper-down']:disabled,
  [part~='stepper-up']:disabled {
    cursor: not-allowed;
  }
  /* The shared chevron glyph points inline-end, so each stepper rotates it onto the block axis.
     The rotation is applied to the svg rather than the button because the button owns the focus
     ring and the hit area, and neither should turn with the glyph. Rotating the wrapping part --
     internal/icons.ts's usual advice -- exists for RTL *mirroring*; both rotations here are
     block-axis, so nothing flips under RTL either way. */
  [part~='stepper-up'] slot > svg {
    transform: rotate(-90deg);
  }
  [part~='stepper-down'] slot > svg {
    transform: rotate(90deg);
  }
`;
