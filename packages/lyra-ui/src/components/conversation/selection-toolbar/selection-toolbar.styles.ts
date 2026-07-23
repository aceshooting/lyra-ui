import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
  }

  [part='toolbar'] {
    position: fixed;
    z-index: var(--lr-overlay-stack-index, 1000);
    inset-inline-start: var(--lr-selection-toolbar-inline-start);
    inset-block-start: var(--lr-selection-toolbar-block-start);
    display: flex;
    flex-wrap: wrap;
    max-inline-size: calc(100vw - var(--lr-space-m));
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
    transform: translate(-50%, calc(-100% - var(--lr-space-xs)));
  }

  :host(:dir(rtl)) [part='toolbar'] {
    transform: translate(50%, calc(-100% - var(--lr-space-xs)));
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
  }

  [part~='action']:hover {
    color: var(--lr-color-brand);
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
