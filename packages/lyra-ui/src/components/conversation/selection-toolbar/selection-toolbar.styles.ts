import { focusRingRoom, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { glassSurface } from '../../../internal/glass-surface.styles.js';
import { glassScrollLayerStyles } from '../../../internal/glass-scroll-layer.styles.js';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  :host {
    display: contents;
    --_lr-selection-toolbar-placement-gap-default: var(--lr-space-s);
  }

  [part='toolbar'] {
    position: fixed;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    inset-inline-start: var(--_lr-selection-toolbar-inline-start);
    inset-block-start: var(--_lr-selection-toolbar-block-start);
    display: flex;
    flex-wrap: wrap;
    inline-size: max-content;
    max-inline-size: min(
      calc(100vw - var(--lr-space-m)),
      var(--_lr-selection-toolbar-max-inline-size, calc(100vw - var(--lr-space-m)))
    );
    max-block-size: var(--_lr-selection-toolbar-max-block-size, calc(100vh - var(--lr-space-m)));
    overflow: auto;
    box-sizing: border-box;
    gap: var(--lr-space-2xs);
    /* The surface scrolls, which clips its actions' outer focus rings unless the padding leaves room. */
    padding: max(var(--lr-space-2xs), ${focusRingRoom});
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts): a floating surface
       retints with every other popup, not with the page behind it. */
    ${overlaySurface}
    /* Anchored overlay: a floating toolbar pinned to the current selection, not a modal layer. */
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    transform: translate(
      -50%,
      calc(-100% - var(--lr-selection-toolbar-placement-gap, var(--_lr-selection-toolbar-placement-gap-default)))
    );
  }

  :host(:dir(rtl)) [part='toolbar'] {
    transform: translate(
      50%,
      calc(-100% - var(--lr-selection-toolbar-placement-gap, var(--_lr-selection-toolbar-placement-gap-default)))
    );
  }

  [part='toolbar'][data-positioned] {
    transform: translate(
      calc(-50% + var(--_lr-selection-toolbar-inline-shift)),
      calc(-100% + var(--_lr-selection-toolbar-block-shift))
    );
  }

  :host(:dir(rtl)) [part='toolbar'][data-positioned] {
    transform: translate(
      calc(50% + var(--_lr-selection-toolbar-inline-shift)),
      calc(-100% + var(--_lr-selection-toolbar-block-shift))
    );
  }

  [part~='action'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    ${iconHitTarget}
    max-inline-size: 100%;
  }

  [part~='action']::part(base) {
    min-inline-size: 0;
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  ${glassScrollLayerStyles}
  .glass-scroll-layer { margin-inline-end: calc(-1 * var(--lr-space-2xs)); }
  ${glassSurface('[part=\'toolbar\']', css`var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-high)))`, undefined, true)}
`;
