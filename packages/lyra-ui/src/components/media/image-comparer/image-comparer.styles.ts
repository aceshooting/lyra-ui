import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Namespaced sizing surface fed by the bare Shoelace-compat names: an unprefixed property
       inherits, so one --handle-size up the tree would silently retune every component reading
       that generic name. Consumers override the --lr-image-comparer-* names on an ancestor or the
       host; the compat names stay the private defaults' fallback source. */
    --_lr-image-comparer-divider-width: var(
      --divider-width,
      var(--lr-size-1px)
    );
    --_lr-image-comparer-handle-size: var(
      --handle-size,
      var(--lr-icon-button-size)
    );
  }
  [part~="base"] {
    position: relative;
    isolation: isolate;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    overflow: hidden;
    background: var(--lr-color-surface-raised);
  }
  [part="before"],
  [part="after"] {
    display: block;
    min-inline-size: 0;
  }
  [part="before"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-content);
    clip-path: inset(0 calc(100% - var(--lr-comparer-position, 50%)) 0 0);
  }
  [part~="base"][data-orientation="vertical"] [part="before"] {
    clip-path: inset(0 0 calc(100% - var(--lr-comparer-position, 50%)) 0);
  }
  /* clip-path's inset() takes only physical top/right/bottom/left offsets, with no logical
     equivalent, while [part='divider'] below uses inset-inline-start, which the browser mirrors
     under RTL. Without this the clipped 'before' region stays pinned physically left while the
     divider and native range handle move right, desyncing the boundary from the dragged line.
     Vertical orientation splits the block axis, unaffected by inline direction, so it is excluded
     and keeps its own rule above. */
  :host(:dir(rtl)) [part="before"] {
    clip-path: inset(0 0 0 calc(100% - var(--lr-comparer-position, 50%)));
  }
  :host(:dir(rtl)) [part~="base"][data-orientation="vertical"] [part="before"] {
    clip-path: inset(0 0 calc(100% - var(--lr-comparer-position, 50%)) 0);
  }
  [part="before"] ::slotted(*),
  [part="after"] ::slotted(*) {
    display: block;
    box-sizing: border-box;
    min-inline-size: 0;
    inline-size: 100%;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  /* The display declaration above is author-origin, so it outranks the UA stylesheet's
     '[hidden] { display: none }' and a hidden slotted child would still paint a hit-testable box.
     Restated here with the UA rule's find-in-page carve-out, so 'hidden' keeps meaning hidden. */
  [part="before"] ::slotted([hidden]:not([hidden="until-found" i])),
  [part="after"] ::slotted([hidden]:not([hidden="until-found" i])) {
    display: none;
  }
  [part="divider"] {
    position: absolute;
    z-index: var(--lr-layer-popover);
    inset-block: 0;
    inset-inline-start: var(--lr-comparer-position, 50%);
    inline-size: var(
      --lr-image-comparer-divider-width,
      var(--_lr-image-comparer-divider-width)
    );
    background: var(--lr-color-surface);
    /* Card step, not the overlay step: the shadow only keeps a hairline legible against arbitrary
       imagery on both sides -- a wider blur reads as a smudge along the seam. */
    box-shadow: var(--lr-shadow-s);
    pointer-events: none;
  }
  [part~="base"][data-orientation="vertical"] [part="divider"] {
    inset-block: auto;
    inset-inline: 0;
    inset-block-start: var(--lr-comparer-position, 50%);
    inline-size: auto;
    block-size: var(
      --lr-image-comparer-divider-width,
      var(--_lr-image-comparer-divider-width)
    );
  }
  [part="handle"] {
    position: absolute;
    /* --lr-layer-tooltip does not exist; with no fallback that is z-index: auto, stacking this
       wrapper BELOW [part='before']'s clipped pointer-events region, which then eats the
       drag/click. Matching [part='divider']'s --lr-layer-popover suffices: the handle renders
       after the divider, so an equal z-index still wins the paint-order tie. */
    z-index: var(--lr-layer-popover);
    inset: 0;
  }
  [part="input"] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    cursor: ew-resize;
  }
  [part~="base"][data-orientation="vertical"] [part="input"] {
    /* A native <input type="range"> maps pointer position along its own inline axis, horizontal-tb
       by default, so without this a drag up/down over the visibly vertical divider does nothing
       and only an invisible sideways drag moves the thumb. vertical-lr runs that axis
       top-to-bottom, matching [part='divider']'s top-anchored inset-block-start above. direction
       is pinned to ltr, not inherited from an ambient dir="rtl", because vertical-lr reverses to
       bottom-to-top under direction: rtl and desyncs the native handle's value from the
       always-top-to-bottom divider -- the same block-axis invariant the 'before' clip-path
       override above relies on. */
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
    inline-size: var(
      --lr-image-comparer-handle-size,
      var(--_lr-image-comparer-handle-size)
    );
    block-size: var(
      --lr-image-comparer-handle-size,
      var(--_lr-image-comparer-handle-size)
    );
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
  [part~="base"][data-orientation="vertical"] .handle-visual {
    inset-block-start: var(--lr-comparer-position, 50%);
    inset-inline-start: 50%;
  }
  .handle-fallback {
    display: inline-flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    direction: ltr;
  }
  .handle-fallback svg {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
  }
  .handle-fallback svg:first-child {
    transform: rotate(180deg);
  }
  [part~="base"][data-orientation="vertical"] .handle-fallback {
    transform: rotate(90deg);
  }
  [part="input"]:hover {
    opacity: 0.01;
  }
  [part="input"]:focus-visible {
    opacity: 0.01;
    outline: none;
  }
  [part="handle"]:has([part="input"]:focus-visible) .handle-visual {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* [part='input'] is a fully-transparent full-bleed native <input type="range">, so hover feedback
     goes on the divider and the whole drag surface responds, not just the small visible handle. */
  [part~="base"]:has([part="input"]:hover) [part="divider"] {
    background: var(--lr-color-brand);
  }
  /* Same :has() indirection as the hover rule above -- the transparent full-bleed input has
     nothing of its own to tint, so mid-drag the seam deepens past its hover accent. */
  [part~="base"]:has([part="input"]:active) [part="divider"] {
    background: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
`;
