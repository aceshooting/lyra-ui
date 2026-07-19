import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-block-size: 0;
    position: relative;
    container-type: inline-size;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-block-size: 0;
    position: relative;
  }
  [part='scroll'] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
    overflow-anchor: none;
    padding: var(--lr-space-m);
  }
  :host(:has(> lr-virtual-list)) [part='scroll'] {
    overflow: visible;
    block-size: auto;
    padding: 0;
  }
  /* Deliberately no padding/gap/margin here -- this coordinate system (the offsetParent for every
   * slotted row) is exactly what the unread divider's own pixel position is computed against.
   * Any block-direction spacing added here would shift that math by a constant amount for every
   * row after the first; breathing room around the transcript belongs on [part="scroll"] instead,
   * one level up, where it can't skew that measurement. Inter-message spacing is left entirely to
   * slotted content (or its host) -- this component renders no messages and imposes no spacing
   * contract of its own. */
  [part='content'] {
    position: relative;
    min-block-size: 100%;
  }
  :host(:has(> lr-virtual-list)) [part='content'] {
    block-size: 100%;
    min-block-size: 0;
  }
  [part='unread-divider'] {
    position: absolute;
    inset-inline: 0;
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    transform: translateY(-50%);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    text-align: center;
    pointer-events: none;
  }
  [part='unread-divider']::before,
  [part='unread-divider']::after {
    content: '';
    flex: 1 1 auto;
    block-size: var(--lr-border-width-thin);
    background: var(--lr-color-border);
  }
  [part='jump-pill'] {
    position: absolute;
    inset-block-end: var(--lr-space-m);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    max-inline-size: calc(100% - 2 * var(--lr-space-m));
    padding-inline: var(--lr-space-m);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    box-shadow: var(--lr-shadow);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity var(--lr-transition-fast);
  }
  /* inset-inline-start: 50% anchors the pill's *start* edge -- the physical right edge under RTL
   * -- to the horizontal center, so the fixed translateX(-50%) above would push the whole pill
   * start-of-center there. Flip the sign to keep it centered (translateX is physical; logical
   * properties don't cover transforms). */
  :host(:dir(rtl)) [part='jump-pill'] {
    transform: translateX(50%);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='jump-pill'] {
      transition: none;
    }
  }
  [part='jump-pill']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @container (max-inline-size: 20rem) {
    [part='jump-pill'] {
      max-inline-size: calc(100% - 2 * var(--lr-space-s));
    }
  }
`;
