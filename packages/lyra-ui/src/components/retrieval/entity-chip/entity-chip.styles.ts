import { css } from 'lit';

export const styles = css`
  :host {
    display: inline;
    line-height: var(--lr-line-height-normal);
  }
  .wrapper {
    display: inline;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    /* Both axes: a short entity label is narrower than the min-inline-size hit-area floor below,
       and the default justify-content (normal => flex-start) left it hugging the leading edge of
       an otherwise symmetric pill. A no-op once the label fills the floor. */
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0 var(--lr-size-6px);
    border: var(--lr-border-width-thin) solid var(--lr-entity-chip-border, transparent);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-entity-chip-bg, var(--lr-color-brand-quiet));
    color: var(--lr-entity-chip-color, var(--lr-color-brand));
    font: inherit;
    font-size: var(--lr-size-0-875em);
    font-weight: var(--lr-font-weight-medium);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  /* A chip with no entity-id renders its button disabled -- the component's own nothing-to-select
     state, reachable by any consumer since entity-id is public. Untreated it was pixel-identical
     to a working chip: full opacity, hand cursor, full hover/press feedback for a control that
     cannot emit. :disabled not [disabled], because only the pseudo-class tracks a
     <fieldset disabled> cascade; every interactive rule below excludes it likewise. Matches
     lr-chip and lr-button. */
  [part='base']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='base']:not(:disabled):hover {
    background: color-mix(in srgb, var(--lr-entity-chip-color, var(--lr-color-brand)) 16%, var(--lr-entity-chip-bg, var(--lr-color-brand-quiet)));
  }
  /* Pressed pushes the hovered fill one step further toward --lr-color-mix-partner, not a larger
     dose of the chip's own accent: that accent is already at 16%, and stepping it to
     --lr-color-mix-active (22%) is a six-point move nobody can see. Mixing toward the partner
     moves the fill whatever per-entity accent the chip was given. */
  [part='base']:not(:disabled):active {
    background: color-mix(
      in oklab,
      color-mix(in srgb, var(--lr-entity-chip-color, var(--lr-color-brand)) 16%, var(--lr-entity-chip-bg, var(--lr-color-brand-quiet))),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='popover'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-22rem));
    padding: var(--lr-space-s) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow-m);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
    color: var(--lr-color-text);
  }
`;
