import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
    --lr-selection-toolbar-placement-gap: var(--lr-space-s);
  }

  [part='toolbar'] {
    position: fixed;
    z-index: var(--lr-overlay-stack-index, 1000);
    inset-inline-start: var(--lr-selection-toolbar-inline-start);
    inset-block-start: var(--lr-selection-toolbar-block-start);
    display: flex;
    flex-wrap: wrap;
    inline-size: max-content;
    max-inline-size: calc(100vw - var(--lr-space-m));
    box-sizing: border-box;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    /* Anchored overlay: a floating toolbar pinned to the current selection, not a modal layer. */
    box-shadow: var(--lr-shadow-m);
    transform: translate(-50%, calc(-100% - var(--lr-selection-toolbar-placement-gap)));
  }

  :host(:dir(rtl)) [part='toolbar'] {
    transform: translate(50%, calc(-100% - var(--lr-selection-toolbar-placement-gap)));
  }

  [part='toolbar'][data-positioned] {
    transform: translate(
      calc(-50% + var(--lr-selection-toolbar-inline-shift)),
      calc(-100% + var(--lr-selection-toolbar-block-shift))
    );
  }

  :host(:dir(rtl)) [part='toolbar'][data-positioned] {
    transform: translate(
      calc(50% + var(--lr-selection-toolbar-inline-shift)),
      calc(-100% + var(--lr-selection-toolbar-block-shift))
    );
  }

  [part~='action'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
  }

  [part~='action']::part(base) {
    min-inline-size: 0;
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  [part~='action']:hover {
    color: var(--lr-color-brand);
  }

  /* Each action is an <lr-button appearance="plain">, which already supplies its own pressed
     treatment (--lr-button-active-scale) inside its shadow root. What this rule adds is the
     toolbar's brand accent escalated one step -- a background box on the host would sit behind the
     button's own transparent base and read as a second, misaligned control. */
  [part~='action']:active {
    color: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part~='action']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='toolbar'] {
      transition: none;
    }
  }
`;
