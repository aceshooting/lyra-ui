import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='row'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='query'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part='mode'] {
    flex: 0 0 auto;
  }
  [part='submit'] {
    flex: 0 0 auto;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding-inline: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
    border-radius: var(--lr-radius);
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  /* filter: brightness() multiplies every channel of the subtree, so it dragged the button's own
     --lr-color-on-brand label along with the fill and moved neither once the brand token was
     themed to pure white or pure black. A background mix toward --lr-color-mix-partner, which
     tracks the text color, always moves, and moves only the fill. */
  [part='submit']:hover {
    background: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part='submit']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='submit']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([loading]) [part='submit'] {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    border-color: var(--lr-color-border);
  }
  :host([loading]) [part='submit']:hover {
    background: var(--lr-color-surface-raised);
  }
  :host([loading]) [part='submit']:active {
    background: color-mix(
      in oklab,
      var(--lr-color-surface-raised),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='filters'] {
    display: flex;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='filters']::part(base) {
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='filters'] lr-chip {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='spinner'] {
    align-self: flex-start;
  }
  [part='error'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='empty'] {
    align-self: stretch;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='submit'] {
      transition: none !important;
    }
  }
`;
