import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    vertical-align: middle;
    --_lr-avatar-group-avatar-size: var(--lr-size-3rem);
    --_lr-avatar-group-overlap: var(--lr-size-neg-6px);
    --_lr-avatar-group-ring-color: var(--lr-color-surface);
    --_lr-avatar-group-ring-width: var(--lr-border-width-medium);
    --_lr-avatar-group-badge-bg: var(--lr-color-border);
    --_lr-avatar-group-badge-color: var(--lr-color-text);
    --_lr-avatar-group-badge-font-size: var(--lr-font-size-m);
  }

  :host([size='2xs']) {
    --_lr-avatar-group-avatar-size: var(--lr-size-1-5rem);
    --_lr-avatar-group-overlap: var(--lr-size-neg-4px);
    --_lr-avatar-group-badge-font-size: var(--lr-font-size-xs);
  }
  :host([size='xs']) {
    --_lr-avatar-group-avatar-size: var(--lr-size-2rem);
    --_lr-avatar-group-overlap: var(--lr-size-neg-4px);
    --_lr-avatar-group-badge-font-size: var(--lr-font-size-sm);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-avatar-group-avatar-size: var(--lr-size-2-5rem);
    --_lr-avatar-group-overlap: var(--lr-size-neg-4px);
    --_lr-avatar-group-badge-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-avatar-group-avatar-size: var(--lr-size-4rem);
    --_lr-avatar-group-overlap: var(--lr-size-neg-8px);
    --_lr-avatar-group-badge-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --_lr-avatar-group-avatar-size: var(--lr-size-5rem);
    --_lr-avatar-group-overlap: var(--lr-size-neg-8px);
    --_lr-avatar-group-badge-font-size: var(--lr-font-size-xl);
  }

  :host([variant='brand']) {
    --_lr-avatar-group-badge-bg: var(--lr-color-brand-quiet);
    --_lr-avatar-group-badge-color: var(--lr-color-brand);
  }
  :host([variant='success']) {
    --_lr-avatar-group-badge-bg: var(--lr-color-success-quiet);
    --_lr-avatar-group-badge-color: var(--lr-color-success);
  }
  :host([variant='warning']) {
    --_lr-avatar-group-badge-bg: var(--lr-color-warning-quiet);
    --_lr-avatar-group-badge-color: var(--lr-color-warning);
  }
  :host([variant='danger']) {
    --_lr-avatar-group-badge-bg: var(--lr-color-danger-quiet);
    --_lr-avatar-group-badge-color: var(--lr-color-danger);
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  ::slotted(lr-avatar) {
    margin-inline-start: var(--lr-avatar-group-overlap, var(--_lr-avatar-group-overlap));
    border-radius: var(--lr-radius-pill);
    box-shadow: 0 0 0
      var(--lr-avatar-group-ring-width, var(--_lr-avatar-group-ring-width))
      var(--lr-avatar-group-ring-color, var(--_lr-avatar-group-ring-color));
  }
  ::slotted(lr-avatar[data-lr-avatar-group-first]) {
    margin-inline-start: 0;
  }
  ::slotted(lr-avatar[data-lr-avatar-group-hidden]) {
    display: none !important;
  }
  ::slotted(lr-avatar[shape='square']) {
    border-radius: 0;
  }
  ::slotted(lr-avatar[shape='rounded']) {
    border-radius: var(--lr-radius);
  }

  [part='overflow-badge'] {
    display: inline-flex;
    flex: 0 0 var(--lr-icon-button-size);
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: outline-color var(--lr-transition-fast);
  }
  [part='overflow-badge-visual'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: var(--lr-avatar-group-avatar-size, var(--_lr-avatar-group-avatar-size));
    block-size: var(--lr-avatar-group-avatar-size, var(--_lr-avatar-group-avatar-size));
    margin-inline-start: var(--lr-avatar-group-overlap, var(--_lr-avatar-group-overlap));
    border-radius: var(--lr-radius-pill);
    box-shadow: 0 0 0
      var(--lr-avatar-group-ring-width, var(--_lr-avatar-group-ring-width))
      var(--lr-avatar-group-ring-color, var(--_lr-avatar-group-ring-color));
    background: var(--lr-avatar-group-badge-bg, var(--_lr-avatar-group-badge-bg));
    color: var(--lr-avatar-group-badge-color, var(--_lr-avatar-group-badge-color));
    font-size: var(--lr-avatar-group-badge-font-size, var(--_lr-avatar-group-badge-font-size));
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
    transition:
      background-color var(--lr-transition-fast),
      box-shadow var(--lr-transition-fast);
  }
  [part='overflow-badge'][data-first-visible] [part='overflow-badge-visual'] {
    margin-inline-start: 0;
  }
  :host([shape='square']) [part='overflow-badge-visual'] {
    border-radius: 0;
  }
  :host([shape='rounded']) [part='overflow-badge-visual'] {
    border-radius: var(--lr-radius);
  }
  [part='overflow-badge']:hover [part='overflow-badge-visual'] {
    box-shadow: 0 0 0
      var(--lr-avatar-group-ring-width, var(--_lr-avatar-group-ring-width))
      var(--lr-color-brand);
  }
  [part='overflow-badge']:active [part='overflow-badge-visual'] {
    box-shadow: 0 0 0
      var(--lr-avatar-group-ring-width, var(--_lr-avatar-group-ring-width))
      var(--lr-color-brand);
    background: color-mix(
      in oklab,
      var(--lr-avatar-group-badge-bg, var(--_lr-avatar-group-badge-bg)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='overflow-badge']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  @media (forced-colors: active) {
    ::slotted(lr-avatar) {
      outline: var(--lr-border-width-medium) solid Canvas;
      box-shadow: 0 0 0 var(--lr-border-width-thick) CanvasText;
    }
    [part='overflow-badge-visual'] {
      border: var(--lr-border-width-medium) solid CanvasText;
      box-shadow: 0 0 0 var(--lr-border-width-medium) Canvas;
      background: Canvas;
      color: CanvasText;
      forced-color-adjust: auto;
    }
    [part='overflow-badge']:hover [part='overflow-badge-visual'] {
      border-color: Highlight;
      box-shadow: 0 0 0 var(--lr-border-width-thick) Highlight;
    }
    [part='overflow-badge']:focus-visible {
      outline-color: Highlight;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part='overflow-badge'],
    [part='overflow-badge-visual'] {
      transition: none !important;
    }
  }
`;
