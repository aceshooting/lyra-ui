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
  /* Virtual mode. Keyed off [part='base']'s data-virtual marker, not :host(:has(> lr-virtual-list)):
     :has() is invalid inside :host() (Chromium reports CSS.supports('selector(:host(:has(> em)))')
     as false), which silently dropped every one of these rules. */
  [part='base'][data-virtual] [part='scroll'] {
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
  [part='base'][data-virtual] [part='content'] {
    block-size: 100%;
    min-block-size: 0;
  }
  /* Virtual mode: [part='scroll'] has stepped aside above, so the slotted list's own viewport is
     the real scroller and has to be this component's full height -- otherwise it scrolls inside
     lr-virtual-list's 24rem --lr-virtual-list-height default no matter how tall this viewport is.
     The explicit block-size is what makes the inherited 100% resolvable: without it the list host
     is auto-height, its own [part='base'] percentage chains to auto, and the two size each other
     circularly. lr-thread-list solves the same problem by turning the internal list's shipped
     24rem into a flex-basis via ::part(base) -- unavailable here, because that list lives in the
     consumer's light DOM and ::slotted() cannot be followed by ::part(). Virtual mode therefore
     inherits this component's existing requirement of a height-bounded parent, exactly as slotted
     mode's own [part='scroll'] already does. A document-tree declaration on the list (a consumer's
     own rule or inline style) still wins over this. */
  [part='base'][data-virtual] ::slotted(lr-virtual-list) {
    block-size: 100%;
    --lr-virtual-list-height: 100%;
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
  [part='jump-pill']:hover {
    background: var(--lr-color-brand-quiet);
  }
  @container (max-inline-size: 20rem) {
    [part='jump-pill'] {
      max-inline-size: calc(100% - 2 * var(--lr-space-s));
    }
  }
`;
