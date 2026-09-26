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
  :host([data-size='2xs']) {
    --lr-form-control-height: var(--lr-theme-form-control-height-2xs, var(--lr-size-1-25rem));
    --lr-form-control-font-size: var(--lr-font-size-2xs);
    --lr-form-control-padding-inline: var(--lr-space-2xs);
    --lr-form-control-padding-block: 0;
  }
  :host([data-size='xs']) {
    --lr-form-control-height: var(--lr-theme-form-control-height-xs, var(--lr-size-1-5rem));
    --lr-form-control-font-size: var(--lr-font-size-xs);
    --lr-form-control-padding-inline: var(--lr-space-xs);
    --lr-form-control-padding-block: 0;
  }
  :host([data-size='s']) {
    --lr-form-control-height: var(--lr-theme-form-control-height-s, var(--lr-size-1-875rem));
    --lr-form-control-font-size: var(--lr-font-size-sm);
    --lr-form-control-padding-inline: var(--lr-space-s);
    --lr-form-control-padding-block: var(--lr-space-2xs);
  }
  :host([data-size='l']) {
    --lr-form-control-height: var(--lr-theme-form-control-height-l, var(--lr-size-3rem));
    --lr-form-control-font-size: var(--lr-font-size-lg);
    --lr-form-control-padding-inline: var(--lr-space-l);
    --lr-form-control-padding-block: var(--lr-space-s);
  }
  :host([data-size='xl']) {
    --lr-form-control-height: var(--lr-theme-form-control-height-xl, var(--lr-size-3-5rem));
    --lr-form-control-font-size: var(--lr-font-size-xl);
    --lr-form-control-padding-inline: var(--lr-space-l);
    --lr-form-control-padding-block: var(--lr-space-s);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-size-24px);
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-24px));
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
  :host(:focus-visible) [part='base'] {
    background: var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='base'][data-focus-visible] {
    background: var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet));
  }
  :host(:where(:active:not([disabled]))) [part='base'] {
    background: var(--lr-menubar-item-active-bg, color-mix(in oklab, var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  [part='base'][data-pressed] {
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
