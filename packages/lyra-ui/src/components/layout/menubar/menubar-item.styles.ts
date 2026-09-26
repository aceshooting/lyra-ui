import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    outline: none;
    border-radius: var(--lr-form-control-radius);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-size-24px);
    min-block-size: max(
      calc(var(--lr-form-control-height) - 2 * var(--lr-form-control-padding-block) - 2 * var(--lr-border-width-thin)),
      var(--lr-size-24px)
    );
    padding-block: 0;
    padding-inline: var(--lr-form-control-padding-inline);
    border-radius: var(--lr-form-control-radius);
    font-size: var(--lr-form-control-font-size);
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-none);
    color: var(--lr-color-text);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: var(--lr-transition-interactive);
  }
  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host(:where(:hover:not([disabled]))) [part='base'],
  :host(:where(:focus-visible)) [part='base'],
  :host(:where([aria-expanded='true'])) [part='base'] {
    background: var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet));
  }
  :host(:where(:active:not([disabled]))) [part='base'] {
    background: var(--lr-menubar-item-active-bg, color-mix(in oklab, var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  :host(:focus-visible) [part='base'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  :host([disabled]) [part='base'] {
    opacity: var(--lr-opacity-disabled);
    cursor: default;
  }
  .menu { display: contents; }
  .menu[hidden] { display: none; }
  @media (forced-colors: active) {
    :host([aria-expanded='true']) [part='base'] {
      outline: var(--lr-border-width-medium) solid currentColor;
      outline-offset: calc(-1 * var(--lr-border-width-medium));
    }
  }
`;
