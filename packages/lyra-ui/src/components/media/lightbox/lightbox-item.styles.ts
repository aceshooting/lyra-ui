import { css } from 'lit';
import { focusRingShorthand, iconHitTarget } from '../../../internal/interactive-control.styles.js';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
  }
  :host([data-empty]) {
    display: none;
  }
  [part="trigger"] {
    position: relative;
    display: block;
    ${iconHitTarget}
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    border-radius: var(--lr-radius);
    transition: var(--lr-transition-interactive);
  }
  [part="trigger"]:hover {
    filter: brightness(1.08);
  }
  [part="trigger"]:focus-visible {
    ${focusRingShorthand}
  }
  :host([data-active]) [part="trigger"] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  ::slotted(img),
  [part="thumbnail-image"] {
    display: block;
    max-inline-size: 100%;
    block-size: auto;
  }
  slot[name="caption"] {
    display: none;
  }
  [part="play-button"] {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  [part="play-button"][hidden] {
    display: none;
  }
  [part="play-glyph"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-lightbox-control-bg, var(--lr-color-neutral));
    color: var(--lr-lightbox-control-color, var(--lr-color-on-neutral));
  }
  :host(:dir(rtl)) [part="play-glyph"] svg {
    transform: none;
  }
`;
