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
  [part='stepper-down'],
  [part='stepper-up'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-input-font-size);
  }
  [part='stepper-down']:hover,
  [part='stepper-up']:hover {
    color: var(--lr-color-text);
  }
  [part='stepper-down']:focus-visible,
  [part='stepper-up']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='stepper-down']:disabled,
  [part='stepper-up']:disabled {
    cursor: not-allowed;
  }
  /* The shared chevron glyph points inline-end; rotating the *wrapping button* (never the svg)
     keeps the icon set direction-free, matching internal/icons.ts's stated contract. Both
     rotations are block-axis, so neither needs to flip under RTL. */
  [part='stepper-up'] > svg {
    transform: rotate(-90deg);
  }
  [part='stepper-down'] > svg {
    transform: rotate(90deg);
  }
`;
