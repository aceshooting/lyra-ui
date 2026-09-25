import { css } from 'lit';

export const styles = css`
  /* A flex-row header allocates the menu its remaining space instead of its content size: a
     content-sized collapsed menu shrinks to its toggle and can never measure wider than the
     breakpoint again. Outside a flex parent the declaration is inert. */
  :host {
    display: block;
    flex: 1 1 0%;
    min-inline-size: 0;
  }

  [part='base'] {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-inline-size: 0;
  }

  [part='list'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: var(--lr-navigation-menu-gap, var(--lr-space-xs));
    min-inline-size: 0;
    margin: 0;
    padding: 0;
  }

  [part='list']:where([data-layout='stacked']) {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
  }

  [part='list'][hidden] {
    display: none;
  }

  [part='toggle'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: 0;
    padding-block: 0;
    padding-inline: var(--lr-space-m);
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }

  [part='toggle']:where(:hover) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }

  [part='toggle']:where(:active) {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  [part='toggle']:where(:focus-visible) {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='toggle-icon'] {
    display: inline-flex;
    align-items: center;
    flex: none;
  }

  /* Decorative. Geometry comes from the open trigger's measured rect through private properties
     written on the element itself. */
  [part='indicator'] {
    position: absolute;
    inset-inline-start: var(--_lr-navigation-menu-indicator-start, 0);
    inset-block-start: var(--_lr-navigation-menu-indicator-top, 100%);
    inline-size: var(--_lr-navigation-menu-indicator-size, 0);
    block-size: var(--lr-navigation-menu-indicator-size, var(--lr-size-0-375rem));
    display: flex;
    align-items: flex-end;
    justify-content: center;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    z-index: var(--lr-layer-dropdown);
    transition:
      inset-inline-start var(--lr-transition-base),
      inline-size var(--lr-transition-base),
      opacity var(--lr-transition-base);
  }

  [part='indicator']:where([data-visible]) {
    opacity: 1;
  }

  [part='indicator-arrow'] {
    position: relative;
    inset-block-start: 60%;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    rotate: 45deg;
    border-start-start-radius: var(--lr-radius);
    background: var(
      --lr-navigation-menu-indicator-color,
      var(--lr-overlay-border, var(--lr-color-border-subtle))
    );
    box-shadow: var(--lr-shadow-s);
  }

  @media (forced-colors: active) {
    [part='indicator-arrow'] {
      background: CanvasText;
    }
  }
`;
