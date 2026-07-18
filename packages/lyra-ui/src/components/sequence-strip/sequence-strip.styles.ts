import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: var(--lyra-size-1px);
    block-size: var(--lyra-sequence-strip-height, var(--lyra-size-1-5rem));
  }
  [part='cell'] {
    position: relative;
    flex: 1 1 0;
    min-inline-size: var(--lyra-size-2px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  /* Round the strip's own outer ends via the first/last cell, not overflow:hidden on [part='base'] --
     that would clip [part='tooltip'], which is deliberately positioned outside the base's own box. */
  [part='cell']:first-child {
    border-start-start-radius: var(--lyra-radius-xs);
    border-end-start-radius: var(--lyra-radius-xs);
  }
  [part='cell']:last-child {
    border-start-end-radius: var(--lyra-radius-xs);
    border-end-end-radius: var(--lyra-radius-xs);
  }
  [part='marker'] {
    display: block;
    inline-size: 100%;
    block-size: var(--lyra-size-2px);
    background: var(--lyra-sequence-strip-marker-color, var(--lyra-color-text));
  }
  [part='tooltip'] {
    position: absolute;
    inset-block-end: 100%;
    inset-inline-start: 50%;
    transform: translate(-50%, calc(-1 * var(--lyra-size-6px)));
    padding: var(--lyra-size-2px) var(--lyra-size-6px);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-xs);
    white-space: nowrap;
    box-shadow: var(--lyra-shadow);
    pointer-events: none;
    z-index: var(--lyra-layer-content);
  }
  /* The tooltip centers on inset-inline-start: 50%, which anchors to the physical right edge
     under RTL -- the fixed horizontal -50% translate must flip sign there or the tooltip sits
     entirely start-of-center (translateX is physical; logical properties don't cover it). */
  :host(:dir(rtl)) [part='tooltip'] {
    transform: translate(50%, calc(-1 * var(--lyra-size-6px)));
  }
  [part='tooltip'][hidden] {
    display: none;
  }
`;
