import { css } from 'lit';

/**
 * `<lr-number-input>`'s stepper pair, layered on the shared `input.styles.ts` sheet.
 *
 * The buttons sit side by side rather than stacked like the platform's spin buttons: each is an
 * independently-clickable target and so carries the library's `--lr-icon-button-size` hit-area
 * floor in both axes, which a stacked pair could only meet by doubling the control row's height.
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
    color: var(--lr-input-action-color, var(--lr-color-text-quiet));
    padding: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-input-font-size, var(--_lr-input-font-size-default));
  }
  [part~='stepper-down']:not(:disabled):hover,
  [part~='stepper-up']:not(:disabled):hover {
    color: var(--lr-input-action-hover-color, var(--lr-color-text));
  }
  /* Pressed. A stepper is the one control here a user holds down to repeat, so a press doing more
     than hover is the only confirmation the auto-repeat is running: the hover's quiet-to-full text
     step plus a fill mixing the page surface toward --lr-color-mix-partner at the active share. */
  [part~='stepper-down']:not(:disabled):active,
  [part~='stepper-up']:not(:disabled):active {
    color: var(--lr-input-action-active-color, var(--lr-input-action-hover-color, var(--lr-color-text)));
    background: var(
      --lr-input-action-active-bg,
      color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
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
  /* The shared chevron points inline-end, so each stepper rotates it onto the block axis -- on the
     svg, not the button, which owns the focus ring and hit area. internal/icons.ts's
     rotate-the-wrapping-part advice is for RTL *mirroring*; both rotations here are block-axis, so
     nothing flips under RTL. */
  [part~='stepper-up'] slot > svg {
    transform: rotate(-90deg);
  }
  [part~='stepper-down'] slot > svg {
    transform: rotate(90deg);
  }
`;
