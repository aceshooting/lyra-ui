import { css } from 'lit';
import { focusRing } from '../interactive-control.styles.js';

/**
 * Preset-button paint shared by the quick-range rows. The adopter's `:host` resolves its public
 * `--lr-<tag>-preset-*` tokens (no fallback) into the private `--_lr-preset-hover-bg`, `-hover-border-color`,
 * `-pressed-bg`, `-pressed-border-color`, `-selected-bg`, `-selected-border-color` and `-selected-color`;
 * unset ones fall through to the defaults here. Geometry stays with the adopter.
 */
export const formControlPresetButton = css`
  [part~='preset-button'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  /* The selected preset keeps its own fill through hover and press; only its own rules below tint it. */
  [part~='preset-button']:not([data-active]):hover:not(:disabled) {
    background: var(--_lr-preset-hover-bg, var(--lr-color-brand-quiet));
    border-color: var(--_lr-preset-hover-border-color, var(--lr-color-brand));
  }
  [part~='preset-button']:not([data-active]):active:not(:disabled) {
    background: var(
      --_lr-preset-pressed-bg,
      color-mix(in oklab, var(--_lr-preset-pressed-base, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    border-color: var(
      --_lr-preset-pressed-border-color,
      color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part~='preset-button'][data-active] {
    background: var(--_lr-preset-selected-bg, var(--lr-color-brand));
    border-color: var(--_lr-preset-selected-border-color, var(--lr-color-brand));
    color: var(--_lr-preset-selected-color, var(--lr-color-on-brand));
  }
  [part~='preset-button'][data-active]:hover:not(:disabled) {
    background-image: linear-gradient(
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover)),
      color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-hover))
    );
  }
  /* Pressed selected preset: by default its fill mixes toward the press partner; an adopter that keeps
     the selected fill and darkens it with an overlay supplies --_lr-preset-selected-pressed-bg and
     --_lr-preset-selected-pressed-image instead, and may keep the selected border. */
  [part~='preset-button'][data-active]:active:not(:disabled) {
    background-color: var(
      --_lr-preset-selected-pressed-bg,
      color-mix(
        in oklab,
        var(--_lr-preset-selected-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    background-image: var(--_lr-preset-selected-pressed-image, none);
    border-color: var(
      --_lr-preset-selected-pressed-border-color,
      color-mix(
        in oklab,
        var(--_lr-preset-selected-border-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part~='preset-button']:focus-visible {
    ${focusRing}
  }
  [part~='preset-button']:disabled {
    cursor: not-allowed;
  }
`;
