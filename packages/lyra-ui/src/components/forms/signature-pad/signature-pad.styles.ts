import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    overflow-wrap: anywhere;
  }

  [part='form-control-label'] {
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
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
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-signature-pad-ink, var(--lr-color-text));
    cursor: crosshair;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition: var(--lr-transition-interactive);
  }
  /* no-pressed-state: the stroke being drawn is the press feedback */
  [part='surface']:where([tabindex]):hover {
    border-color: var(--lr-color-text-quiet);
  }
  [part='surface']:focus-visible,
  [part='clear-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host(:state(user-invalid)) [part='surface'] {
    border-color: var(--lr-color-danger);
  }
  :host(:disabled) [part='surface'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
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

  [part='clear-button'] {
    justify-self: end;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part='clear-button']:not(:disabled):hover {
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part='clear-button']:not(:disabled):active {
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='clear-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: default;
  }

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='error'] {
    color: var(--lr-color-danger);
  }
`;
