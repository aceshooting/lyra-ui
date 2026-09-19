import { css } from 'lit';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  :host {
    display: inline-block;
    position: relative;
    --_lr-export-button-background: var(--lr-color-surface);
    --_lr-export-button-color: var(--lr-color-text);
    --_lr-export-button-border: var(--lr-color-border);
    --_lr-export-button-hover-background: var(--lr-color-surface);
    --_lr-export-button-hover-color: var(--lr-color-text);
    --_lr-export-button-hover-border: var(--lr-color-brand);
    --_lr-export-button-active-background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    --_lr-export-button-active-color: var(--lr-color-text);
    --_lr-export-button-active-border: var(--lr-color-brand);
  }
  :host([appearance='outlined']) {
    --_lr-export-button-background: transparent;
    --_lr-export-button-color: var(--lr-color-brand);
    --_lr-export-button-border: var(--lr-color-border-strong);
    --_lr-export-button-hover-background: var(--lr-color-brand-quiet);
    --_lr-export-button-hover-color: var(--lr-color-brand);
    --_lr-export-button-hover-border: var(--lr-color-brand);
    --_lr-export-button-active-background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    --_lr-export-button-active-color: var(--lr-color-brand);
    --_lr-export-button-active-border: var(--lr-color-brand);
  }
  :host([appearance='quiet']) {
    --_lr-export-button-background: transparent;
    --_lr-export-button-color: var(--lr-color-text-quiet);
    --_lr-export-button-border: var(--lr-color-border);
    --_lr-export-button-hover-background: var(--lr-color-brand-quiet);
    --_lr-export-button-hover-color: var(--lr-color-text-quiet);
    --_lr-export-button-hover-border: var(--lr-color-brand);
    --_lr-export-button-active-background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    --_lr-export-button-active-color: var(--lr-color-text-quiet);
    --_lr-export-button-active-border: var(--lr-color-brand);
  }
  [part~='trigger'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid
      var(--lr-export-button-border, var(--_lr-export-button-border));
    border-radius: var(--lr-radius);
    background: var(--lr-export-button-background, var(--_lr-export-button-background));
    color: var(--lr-export-button-color, var(--_lr-export-button-color));
    font: inherit;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
  }
  /* :where() zeroes the wrapped selectors' specificity, leaving :hover alone at (0,1,0). Unwrapped,
     [part='trigger']:hover:not(:disabled) is (0,3,0) and out-ranks the source-later :active rule
     below, swallowing the pressed state. */
  :where([part~='trigger']):hover:where(:not(:disabled)) {
    background: var(--lr-export-button-hover-background, var(--_lr-export-button-hover-background));
    color: var(--lr-export-button-hover-color, var(--_lr-export-button-hover-color));
    border-color: var(--lr-export-button-hover-border, var(--_lr-export-button-hover-border));
  }
  /* Same :where() shape as the hover rule above, so the two tie at (0,1,0) and source order hands
     this one the press. */
  :where([part~='trigger']):active:where(:not(:disabled)) {
    background: var(--lr-export-button-active-background, var(--_lr-export-button-active-background));
    color: var(--lr-export-button-active-color, var(--_lr-export-button-active-color));
    border-color: var(--lr-export-button-active-border, var(--_lr-export-button-active-border));
  }
  :host([size='2xs']) [part~='trigger'],
  :host([size='xs']) [part~='trigger'],
  :host([size='s']) [part~='trigger'],
  :host([size='small']) [part~='trigger'],
  :host([size='m']) [part~='trigger'],
  :host([size='medium']) [part~='trigger'],
  :host([size='l']) [part~='trigger'],
  :host([size='large']) [part~='trigger'],
  :host([size='xl']) [part~='trigger'],
  :host([size='2xs']) [part='menu-item'],
  :host([size='xs']) [part='menu-item'],
  :host([size='s']) [part='menu-item'],
  :host([size='small']) [part='menu-item'],
  :host([size='m']) [part='menu-item'],
  :host([size='medium']) [part='menu-item'],
  :host([size='l']) [part='menu-item'],
  :host([size='large']) [part='menu-item'],
  :host([size='xl']) [part='menu-item'] {
    font-size: var(--lr-form-control-font-size);
    padding-block: var(--lr-form-control-padding-block);
    padding-inline: var(--lr-form-control-padding-inline);
    min-block-size: max(var(--lr-icon-button-size), var(--lr-form-control-height));
  }
  [part~='trigger']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part~='trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Present alongside 'trigger' after a built-in CSV/JSON export fails, until the next attempt --
     see the matching 'lr-export-error' JSDoc. Paired with a live-region announcement of the same
     failure, since color alone is not an accessible signal. */
  [part~='trigger-error'] {
    border-color: var(--lr-color-danger);
    color: var(--lr-color-danger);
  }
  [part='menu'] {
    /* Closed state: invisible and slightly raised. visibility, not display:none, so opacity and
       transform can transition; hit-testing and a11y exposure stay off, and this part is already
       position:fixed. visibility is deliberately untransitioned: a transitioned property only
       settles at its target after the UA runs a style-change/rendering pass, which lags a same-tick
       attribute write -- updated() focusing the first menu item straight after flipping open would
       find it still visibility: hidden and silently fail. Untransitioned, it applies in the same
       synchronous style pass as the open attribute write. */
    visibility: hidden;
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    inline-size: max-content;
    min-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-8rem),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-20rem),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-block-size: var(--lr-positioner-available-block-size, 100vh);
    overflow: auto;
    padding: var(--lr-space-xs);
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts): a floating surface
       retints with every other popup, not with the page behind it. */
    ${overlaySurface}
    /* Anchored overlay: a positioner-placed menu floating over page content, not a modal layer. */
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    opacity: 0;
    transform: translateY(var(--lr-size-neg-4px));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast);
  }
  :host([open]) [part='menu'] {
    visibility: visible;
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='menu'] {
      transition: none;
    }
  }
  [part='menu-item'] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--lr-size-1px);
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    text-align: center;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    border-radius: var(--lr-radius);
  }
  /* :where() zeroes the wrapped selectors' specificity contribution -- see the [part='trigger']
     hover rule above for the full rationale. */
  :where([part='menu-item']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
  }
  :where([part='menu-item']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='menu-item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='menu-item']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='format-description'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='format-label'],
  [part='format-description'] {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
