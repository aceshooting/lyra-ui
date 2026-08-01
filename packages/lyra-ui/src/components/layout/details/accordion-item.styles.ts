import { css } from 'lit';

export const styles = css`
  :host {
    --spacing: var(--lr-form-control-padding-inline);
    --show-duration: var(--lr-duration-base);
    --hide-duration: var(--lr-duration-base);
    --easing: var(--lr-easing-standard);
    display: block;
    min-inline-size: 0;
    color: var(--lr-color-text);
  }
  [part~='accordion-item'] {
    min-inline-size: 0;
    background: transparent;
  }
  :host([appearance='outlined']) [part~='accordion-item'] {
    background: var(--lr-color-surface);
  }
  :host([appearance='filled']) [part~='accordion-item'],
  :host([appearance='filled-outlined']) [part~='accordion-item'] {
    background: var(--lr-color-surface-raised);
  }
  [part~='heading'] {
    margin: 0;
    font: inherit;
  }
  [part~='button'] {
    display: flex;
    align-items: center;
    gap: var(--spacing);
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    padding: var(--spacing);
    border: none;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  [part~='button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part~='button']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~='button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-width) * -1);
  }
  [part~='button']:disabled {
    cursor: not-allowed;
  }
  :host([disabled]) [part~='accordion-item'] {
    opacity: var(--lr-opacity-disabled);
  }
  [part~='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part~='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    transition: transform var(--hide-duration) var(--easing);
  }
  :host([icon-placement='start']) [part~='icon'] {
    order: -1;
  }
  .default-icon {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-inline-end: var(--lr-border-width-thin) solid currentColor;
    border-block-end: var(--lr-border-width-thin) solid currentColor;
    transform: rotate(-45deg);
  }
  :host(:dir(rtl)) .default-icon {
    transform: rotate(45deg);
  }
  :host([open]) [part~='icon'],
  :host([expanded]) [part~='icon'] {
    transform: rotate(90deg);
    transition-duration: var(--show-duration);
  }
  :host([open]:dir(rtl)) [part~='icon'],
  :host([expanded]:dir(rtl)) [part~='icon'] {
    transform: rotate(-90deg);
  }
  [part~='panel'] {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    opacity: 0;
    color: var(--lr-color-text-quiet);
    transition:
      grid-template-rows var(--hide-duration) var(--easing),
      opacity var(--hide-duration) var(--easing),
      visibility var(--hide-duration) step-end;
  }
  :host([open]) [part~='panel'],
  :host([expanded]) [part~='panel'] {
    grid-template-rows: 1fr;
    visibility: visible;
    opacity: 1;
    transition-duration: var(--show-duration);
    transition-timing-function: var(--easing);
  }
  .panel-clip {
    min-block-size: 0;
    overflow: hidden;
  }
  [part~='content'] {
    display: block;
    padding: 0 var(--spacing) var(--spacing);
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='panel'],
    [part~='icon'] {
      transition: none;
    }
  }
`;
