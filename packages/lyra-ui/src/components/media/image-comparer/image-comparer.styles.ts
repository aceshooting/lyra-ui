import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part~='base'] {
    position: relative;
    isolation: isolate;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    overflow: hidden;
    background: var(--lr-color-surface-raised);
  }
  [part='before'],
  [part='after'] {
    display: block;
    min-inline-size: 0;
  }
  [part='before'] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-content);
    clip-path: inset(0 calc(100% - var(--lr-comparer-position, 50%)) 0 0);
  }
  [part~='base'][data-orientation='vertical'] [part='before'] {
    clip-path: inset(0 0 calc(100% - var(--lr-comparer-position, 50%)) 0);
  }
  /* clip-path's inset() only accepts physical top/right/bottom/left offsets -- no logical
     equivalent exists -- while [part='divider'] below is positioned with the logical
     inset-inline-start, which the browser already mirrors under RTL on its own. Without this
     override the clipped 'before' region stays pinned to the physical-left portion regardless of
     direction, while the divider (and native range-input handle) move to the right under RTL,
     visibly desyncing the boundary from the line the user is dragging. Vertical orientation is a
     block-axis split, unaffected by inline direction, so it's excluded and keeps its own rule above. */
  :host(:dir(rtl)) [part='before'] {
    clip-path: inset(0 0 0 calc(100% - var(--lr-comparer-position, 50%)));
  }
  :host(:dir(rtl)) [part~='base'][data-orientation='vertical'] [part='before'] {
    clip-path: inset(0 0 calc(100% - var(--lr-comparer-position, 50%)) 0);
  }
  [part='before'] ::slotted(*),
  [part='after'] ::slotted(*) {
    display: block;
    inline-size: 100%;
    max-inline-size: 100%;
  }
  [part='divider'] {
    position: absolute;
    z-index: var(--lr-layer-popover);
    inset-block: 0;
    inset-inline-start: var(--lr-comparer-position, 50%);
    inline-size: var(--divider-width, var(--lr-size-1px));
    background: var(--lr-color-surface);
    /* Card step, not the overlay step: the shadow here only has to keep a hairline legible against
       arbitrary imagery on both sides -- a wider blur reads as a smudge along the seam. */
    box-shadow: var(--lr-shadow-s);
    pointer-events: none;
  }
  [part~='base'][data-orientation='vertical'] [part='divider'] {
    inset-block: auto;
    inset-inline: 0;
    inset-block-start: var(--lr-comparer-position, 50%);
    inline-size: auto;
    block-size: var(--divider-width, var(--lr-size-1px));
  }
  [part='handle'] {
    position: absolute;
    /* --lr-layer-tooltip does not exist (no fallback -> z-index: auto, stacking the interaction
       wrapper BELOW [part='before']'s clipped pointer-events-enabled region and intercepting its
       own drag/click input). Matching [part='divider']'s own --lr-layer-popover is sufficient: the
       handle renders after the divider, so an equal z-index still wins the paint-order tie. */
    z-index: var(--lr-layer-popover);
    inset: 0;
  }
  [part='input'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    cursor: ew-resize;
  }
  [part~='base'][data-orientation='vertical'] [part='input'] {
    /* A native <input type="range"> always maps pointer position along its own inline axis,
       which defaults to horizontal-tb -- so without this override, dragging up/down over the
       visibly vertical divider does nothing; only a horizontal drag (invisible, off to the
       side) would move the thumb. writing-mode: vertical-lr switches the input's inline axis to
       run top-to-bottom, matching [part='divider']'s own top-anchored inset-block-start above.
       direction is pinned to ltr (rather than left to inherit an ambient dir="rtl") because
       vertical-lr's inline progression reverses to bottom-to-top under direction: rtl, which
       would desync the native handle's value from the always-top-to-bottom divider position --
       the same block-axis-is-unaffected-by-inline-direction invariant the 'before' clip-path
       override above already relies on for vertical orientation. */
    writing-mode: vertical-lr;
    direction: ltr;
    cursor: ns-resize;
  }
  .handle-visual {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: var(--lr-comparer-position, 50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--handle-size, var(--lr-icon-button-size));
    block-size: var(--handle-size, var(--lr-icon-button-size));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    box-shadow: var(--lr-shadow-s);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }
  :host(:dir(rtl)) .handle-visual {
    transform: translate(50%, -50%);
  }
  [part~='base'][data-orientation='vertical'] .handle-visual {
    inset-block-start: var(--lr-comparer-position, 50%);
    inset-inline-start: 50%;
  }
  .handle-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .handle-fallback svg {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
  }
  .handle-fallback svg:first-child {
    transform: rotate(180deg);
  }
  [part~='base'][data-orientation='vertical'] .handle-fallback {
    transform: rotate(90deg);
  }
  [part='input']:hover {
    opacity: 0.01;
  }
  [part='input']:focus-visible {
    opacity: 0.01;
    outline: none;
  }
  [part='handle']:has([part='input']:focus-visible) .handle-visual {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* [part='input'] is a fully-transparent full-bleed native <input type="range">. Keep hover
     feedback on the divider too, so the full drag surface responds even when the pointer isn't
     directly over the small visible handle. */
  [part~='base']:has([part='input']:hover) [part='divider'] {
    background: var(--lr-color-brand);
  }
  /* Pressed rides the same :has() indirection as the hover rule above: the transparent full-bleed
     input has nothing of its own to tint, so mid-drag the seam deepens past its hover accent. */
  [part~='base']:has([part='input']:active) [part='divider'] {
    background: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
`;
