import { forcedColorsDivider } from '../../../internal/forced-colors.styles.js';
import {
  activeFill,
  focusRing,
  hoverFill,
  iconHitTarget,
  interactiveTransition,
} from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lr-checkpoint-gap, var(--lr-space-s));
    inline-size: 100%;
  }
  .checkpoint-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: inherit;
    min-inline-size: 0;
  }
  [part='line'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    block-size: var(--lr-border-width-thin);
    background: var(--lr-color-border-subtle);
  }
  [part='icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--lr-color-text-quiet);
  }
  [part='label'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-sm);
  }
  [part='timestamp'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  /* All three actions clear the shared --lr-icon-button-size hit-area floor: the compact text
     would otherwise leave a destructive confirm well under the touch target size. */
  [part='restore-button'],
  [part='confirm-button'],
  [part='cancel-button'] {
    ${iconHitTarget}
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
    ${interactiveTransition}
  }
  [part='restore-button'] {
    gap: var(--lr-size-0-35em);
    flex: 0 0 auto;
    padding: var(--lr-size-0-25rem) var(--lr-checkpoint-button-padding-inline, var(--lr-space-s));
    border: var(--lr-border-width-thin) solid var(--lr-checkpoint-button-border-color, var(--lr-color-border));
    border-radius: var(--lr-checkpoint-button-radius, var(--lr-radius-pill));
    background: var(--lr-checkpoint-button-bg, var(--lr-color-surface));
    color: var(--lr-checkpoint-button-color, var(--lr-color-text));
  }
  [part='restore-button']:hover:not([aria-disabled='true']) {
    border-color: var(--lr-checkpoint-button-hover-border-color, var(--lr-color-brand));
    color: var(--lr-checkpoint-button-hover-color, var(--lr-color-brand));
  }
  /* Hover recolors the chrome only; the press keeps that chrome and additionally fills the pill,
     mixing its resting surface toward the text color so the pressed state is a strictly stronger
     signal than hover rather than a differently-colored one. */
  [part='restore-button']:active:not([aria-disabled='true']) {
    border-color: var(--lr-checkpoint-button-hover-border-color, var(--lr-color-brand));
    color: var(--lr-checkpoint-button-hover-color, var(--lr-color-brand));
    background: var(--lr-checkpoint-button-active-bg, ${activeFill('var(--lr-color-surface)')});
  }
  [part='restore-button']:focus-visible {
    ${focusRing}
  }
  [part='restore-button'][aria-disabled='true'] {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }
  .restore-spinner {
    display: inline-flex;
  }
  .restore-spinner svg {
    display: block;
    animation: var(--_lr-motion-animation, lr-checkpoint-spin var(--lr-checkpoint-spin-duration, var(--lr-transition-ambient)) infinite);
  }
  [part='confirm-group'] {
    max-inline-size: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
  }
  [part='confirm-prompt'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='confirm-button'],
  [part='cancel-button'] {
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }
  [part='confirm-button'] {
    --_lr-checkpoint-confirm-fill: var(--lr-checkpoint-confirm-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-checkpoint-confirm-border-color, var(--lr-color-brand));
    background: var(--_lr-checkpoint-confirm-fill);
    color: var(--lr-checkpoint-confirm-color, var(--lr-color-brand));
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='cancel-button'] {
    --_lr-checkpoint-cancel-fill: var(--lr-checkpoint-cancel-bg, var(--lr-color-surface));
    background: var(--_lr-checkpoint-cancel-fill);
    color: var(--lr-checkpoint-cancel-color, var(--lr-color-text));
  }
  [part='confirm-button']:focus-visible,
  [part='cancel-button']:focus-visible {
    ${focusRing}
  }
  [part='confirm-button']:hover {
    background: var(--lr-checkpoint-confirm-hover-bg, ${hoverFill('var(--_lr-checkpoint-confirm-fill)')});
  }
  [part='confirm-button']:active {
    background: var(--lr-checkpoint-confirm-active-bg, ${activeFill('var(--_lr-checkpoint-confirm-fill)')});
  }
  [part='cancel-button']:hover {
    background: var(--lr-checkpoint-cancel-hover-bg, var(--lr-color-surface-raised));
  }
  [part='cancel-button']:active {
    background: var(--lr-checkpoint-cancel-active-bg, ${activeFill('var(--lr-checkpoint-cancel-hover-bg, var(--lr-color-surface-raised))')});
  }
  @keyframes lr-checkpoint-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .restore-spinner svg {
      animation: none !important;
    }
  }
  ${forcedColorsDivider("[part='line']")}
`;
