import { iconAction, iconActionStyles } from '../../../internal/icon-action.styles.js';
import { activeFill, disabledControl, focusRing, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow-m);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  ${iconActionStyles(":is([part='zoom-in'], [part='zoom-out'], [part='fit'], [part='lock'])", {
    color: 'var(--lr-color-text)',
    hoverColor: 'var(--lr-color-text)',
    activeColor: 'var(--lr-color-text)',
    hoverBackground: 'var(--lr-flow-controls-hover-bg, var(--lr-color-neutral-fill-quiet))',
    activeBackground: `var(--lr-flow-controls-active-bg, ${activeFill('var(--lr-color-neutral-fill-quiet)').cssText})`,
  })}
  [part='zoom-in'],
  [part='zoom-out'],
  [part='fit'],
  [part='lock'] {
    transition: background-color var(--lr-transition-fast);
  }
  ::slotted(button) {
    --_lr-icon-button-color-default: var(--lr-color-text);
    --_lr-flow-controls-hover-bg: var(--lr-flow-controls-hover-bg, var(--lr-color-neutral-fill-quiet));
    --_lr-flow-controls-active-bg: var(--lr-flow-controls-active-bg, ${activeFill('var(--lr-color-neutral-fill-quiet)')});
    ${iconHitTarget}
    ${iconAction}
    ${interactiveTransition}
  }
  [part='lock'][aria-pressed='true'] {
    --_lr-icon-button-color-default: var(--lr-flow-controls-lock-active-color, var(--lr-color-brand));
    --_lr-icon-button-color-hover-default: var(--lr-flow-controls-lock-active-color, var(--lr-color-brand));
    --_lr-icon-button-color-active-default: var(--lr-flow-controls-lock-active-color, var(--lr-color-brand));
  }
  ::slotted(button) {
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  ::slotted([hidden]:not([hidden='until-found' i])) {
    display: none;
  }
  ::slotted(button:hover:not(:disabled)) {
    background: var(--_lr-flow-controls-hover-bg);
  }
  ::slotted(button:active:not(:disabled)) {
    background: var(--_lr-flow-controls-active-bg);
  }
  ::slotted(button:disabled) {
    ${disabledControl}
  }
  ::slotted(button:focus-visible) {
    ${focusRing}
  }
`;
