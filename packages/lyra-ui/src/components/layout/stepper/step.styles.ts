import { css } from 'lit';
import { visuallyHidden } from '../../../internal/a11y.js';
import { activeFill, disabledControl, focusRing } from '../../../internal/interactive-control.styles.js';

export const stepStyles = css`
  :host {
    display: block;
    flex: 1 1 0;
    min-inline-size: 0;
    --_pad: var(--lr-space-2xs);
    --_size: var(--marker-size, var(--lr-stepper-marker-size, var(--lr-size-2rem)));
    --_cw: var(--connector-width, var(--lr-stepper-connector-width, var(--lr-border-width-medium)));
    --_gap: var(--connector-gap, var(--lr-stepper-connector-gap, var(--lr-size-0-35em)));
    --_fill: var(--lr-color-brand);
    --_on: var(--lr-color-on-brand);
    --_line: var(--connector-color, var(--lr-stepper-connector-color, var(--lr-color-neutral-fill-normal)));
  }
  :host([variant='neutral']) {
    --_fill: var(--lr-color-neutral);
    --_on: var(--lr-color-on-neutral);
  }
  :host([variant='success']) {
    --_fill: var(--lr-color-success);
    --_on: var(--lr-color-on-success);
  }
  :host([variant='warning']) {
    --_fill: var(--lr-color-warning);
    --_on: var(--lr-color-on-warning);
  }
  :host([variant='danger']) {
    --_fill: var(--lr-color-danger);
    --_on: var(--lr-color-on-danger);
  }
  .visually-hidden {
    ${visuallyHidden}
  }
  [hidden] {
    display: none !important;
  }
  .step {
    position: relative;
  }
  .body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    inline-size: 100%;
    margin: 0;
    padding: var(--_pad);
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    text-align: center;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  button.body {
    cursor: pointer;
  }
  button.body:focus-visible {
    ${focusRing}
  }
  /* :where() keeps the hover rule below the active/completed color rules, so those steps keep their
     own color under the pointer. */
  :where(button.body):hover:where(:not(:disabled)) {
    background: var(--lr-stepper-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-stepper-hover-color, var(--lr-color-text));
  }
  :where(button.body):active:where(:not(:disabled)) {
    background: var(--lr-stepper-active-bg, ${activeFill('var(--lr-color-brand-quiet)')});
    color: var(--lr-stepper-active-color, var(--lr-color-text));
  }
  button.body:disabled {
    ${disabledControl}
  }
  [data-disabled]:not(button) .body {
    opacity: var(--lr-opacity-disabled);
  }
  .step[data-active] .body,
  .step[data-completed] .body {
    color: var(--lr-color-text);
  }
  .step[data-active] .label {
    font-weight: var(--lr-font-weight-semibold);
  }
  .marker {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-sizing: border-box;
    inline-size: var(--_size);
    block-size: var(--_size);
    border-radius: var(--lr-radius-pill);
    border: var(--lr-border-width-medium) solid var(--_fill);
    background: transparent;
    color: var(--_fill);
    font-size: var(--lr-font-size-sm);
    font-variant-numeric: tabular-nums;
    --_pulse: var(--pulse-color, var(--lr-step-pulse-color, var(--_fill)));
  }
  :host([variant='brand']) .step:not([data-active]):not([data-completed]) .marker {
    border-color: var(--lr-color-neutral-fill-normal);
    color: var(--lr-color-text-quiet);
  }
  .step[data-active] .marker,
  .step[data-completed] .marker {
    background: var(--_fill);
    border-color: var(--_fill);
    color: var(--_on);
  }
  .check,
  .spinner {
    display: inline-flex;
  }
  .spinner {
    animation: lr-step-spin var(--lr-duration-ambient) linear infinite;
  }
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-inline-size: 0;
  }
  .description {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  .connector {
    position: absolute;
    box-sizing: border-box;
    background: var(--_line);
    pointer-events: none;
  }
  .connector-end {
    background: var(--connector-color-active, var(--lr-stepper-connector-active-color, var(--_fill)));
  }
  .step:not([data-completed]) .connector-end {
    background: var(--_line);
  }
  .connector-start {
    background: var(--_line);
  }
  .connector-start[data-variant='neutral'] {
    background: var(--connector-color-active, var(--lr-stepper-connector-active-color, var(--lr-color-neutral)));
  }
  .connector-start[data-variant='brand'] {
    background: var(--connector-color-active, var(--lr-stepper-connector-active-color, var(--lr-color-brand)));
  }
  .connector-start[data-variant='success'] {
    background: var(--connector-color-active, var(--lr-stepper-connector-active-color, var(--lr-color-success)));
  }
  .connector-start[data-variant='warning'] {
    background: var(--connector-color-active, var(--lr-stepper-connector-active-color, var(--lr-color-warning)));
  }
  .connector-start[data-variant='danger'] {
    background: var(--connector-color-active, var(--lr-stepper-connector-active-color, var(--lr-color-danger)));
  }
  .step[data-first] .connector-start,
  .step[data-last] .connector-end {
    display: none;
  }
  /* Horizontal: the lines run along the marker's centre line, clear of the marker by --_gap. */
  .connector {
    block-size: var(--_cw);
    inset-block-start: calc(var(--_pad) + var(--_size) / 2 - var(--_cw) / 2);
  }
  .connector-start {
    inset-inline-start: 0;
    inset-inline-end: calc(50% + var(--_size) / 2 + var(--_gap));
  }
  .connector-end {
    inset-inline-start: calc(50% + var(--_size) / 2 + var(--_gap));
    inset-inline-end: 0;
  }
  /* Vertical: the marker sits in a leading column with the lines above and below it. */
  .step[data-vertical] {
    padding-block: var(--gap, var(--lr-stepper-step-gap, var(--lr-space-m))) 0;
  }
  .step[data-vertical] .body {
    flex-direction: row;
    align-items: flex-start;
    text-align: start;
  }
  .step[data-vertical] .content {
    align-items: flex-start;
    padding-block-start: calc((var(--_size) - 1lh) / 2);
  }
  .step[data-vertical] .connector {
    block-size: auto;
    inline-size: var(--_cw);
    inset-inline-start: calc(var(--_pad) + var(--_size) / 2 - var(--_cw) / 2);
    inset-inline-end: auto;
  }
  .step[data-vertical] .connector-start {
    inset-block-start: 0;
    inset-block-end: auto;
    block-size: calc(var(--gap, var(--lr-stepper-step-gap, var(--lr-space-m))) + var(--_pad) - var(--_gap));
  }
  .step[data-vertical] .connector-end {
    inset-block-start: calc(var(--gap, var(--lr-stepper-step-gap, var(--lr-space-m))) + var(--_pad) + var(--_size) + var(--_gap));
    inset-block-end: 0;
  }
  .step[data-vertical][data-first] {
    padding-block-start: 0;
  }
  .step[data-vertical][data-first] .connector-end {
    inset-block-start: calc(var(--_pad) + var(--_size) + var(--_gap));
  }
  @keyframes lr-step-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes lr-step-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--_pulse) 55%, transparent);
    }
    100% {
      box-shadow: 0 0 0 var(--lr-size-6px) transparent;
    }
  }
  @keyframes lr-step-bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(var(--lr-size-neg-4px));
    }
  }
  .marker[data-attention='pulse'] {
    animation: lr-step-pulse var(--lr-duration-ambient) ease-out infinite;
  }
  .marker[data-attention='bounce'] {
    animation: lr-step-bounce var(--lr-duration-ambient) ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .marker[data-attention],
    .spinner {
      animation: none;
    }
  }
  @media (forced-colors: active) {
    .marker {
      border-color: CanvasText;
      forced-color-adjust: none;
      color: CanvasText;
      background: Canvas;
    }
    .step[data-active] .marker,
    .step[data-completed] .marker {
      background: Highlight;
      color: HighlightText;
      border-color: Highlight;
    }
    .connector {
      background: CanvasText;
    }
  }
`;
