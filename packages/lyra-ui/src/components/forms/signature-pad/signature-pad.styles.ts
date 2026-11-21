import { outlinedActionStyles } from '../../../internal/icon-action.styles.js';
import { formControlAppearance } from '../../../internal/form-control/appearance.styles.js';
import { activeFill, disabledControl, focusRing, hoverFill } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { formControlLabelPlacement } from '../../../internal/form-control/chrome.styles.js';
import { formControlLabelTypography, formControlRequiredMarker, formControlSupportingTone, formControlLabelDisplay } from '../../../internal/form-control.styles.js';

export const styles = css`
  ${formControlAppearance}
  :host {
    display: block;
    overflow-wrap: anywhere;
  }

  [part='form-control-label'] {
    ${formControlLabelTypography()}
    margin-block-end: var(--lr-space-xs);
  }
  ${formControlRequiredMarker}

  [part='base'] {
    display: grid;
    gap: var(--lr-space-xs);
  }

  [part='surface'] {
    position: relative;
    box-sizing: border-box;
    aspect-ratio: var(--lr-signature-pad-aspect-ratio, 3 / 1);
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-signature-pad-border-color, var(--_lr-form-control-border-color));
    border-radius: var(--lr-signature-pad-radius, var(--lr-form-control-radius));
    background: var(--lr-signature-pad-fill, var(--_lr-form-control-fill));
    color: var(--lr-signature-pad-ink, var(--lr-color-text));
    cursor: crosshair;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition: var(--lr-transition-interactive);
  }
  /* no-pressed-state: the stroke being drawn is the press feedback */
  :host(:where(:not([readonly]))) [part='surface']:where([tabindex]):hover {
    border-color: var(--lr-signature-pad-hover-border-color, var(--lr-color-text-quiet));
  }
  [part='surface']:focus-visible,
  [part='clear-button']:focus-visible {
    ${focusRing}
  }
  :host(:state(user-invalid)) [part='surface'] {
    border-color: var(--lr-signature-pad-invalid-border-color, var(--lr-form-control-invalid-border-color, var(--lr-color-danger)));
  }
  :host([readonly]) [part='surface'] { cursor: default; }
  :host(:disabled) [part='surface'] {
    ${disabledControl}
  }

  svg {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
  }
  path {
    fill: none;
    stroke: currentColor;
    stroke-width: var(--lr-signature-pad-stroke-width, var(--lr-border-width-medium));
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  [part='cursor'] {
    position: absolute;
    box-sizing: border-box;
    inline-size: var(--lr-space-s);
    block-size: var(--lr-space-s);
    translate: -50% -50%;
    border: var(--lr-border-width-medium) solid var(--lr-focus-ring-color);
    border-radius: 50%;
    pointer-events: none;
  }
  [part='cursor'][data-down] {
    background: var(--lr-focus-ring-color);
  }
  [part='surface']:not(:focus-visible) [part='cursor'] {
    display: none;
  }

  [part='clear-button'] { justify-self: end; }
  ${outlinedActionStyles("[part='clear-button']", {
    padding: false,
    extra: 'padding-inline: var(--lr-space-s);',
    hoverBackground: `var(--lr-signature-pad-clear-hover-bg, ${hoverFill('var(--lr-color-surface)').cssText})`,
    activeBackground: `var(--lr-signature-pad-clear-active-bg, ${activeFill('var(--lr-color-surface)').cssText})`,
  })}

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
  }
  ${formControlSupportingTone}
  ${formControlLabelDisplay}
  ${formControlLabelPlacement}
`;
