import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
    /* Component-specific -- not a shared design token, so a consumer can
       retheme it without a raw literal leaking into the public API (same
       rationale as lr-app-rail's --lr-app-rail-overlay-color). */
    --_lr-multi-split-overlay-color: var(--lr-color-overlay);
    /* The divider owns a real target gutter instead of extending a pseudo
       element over either neighboring panel. Only the centered line is
       painted; the full track remains available for pointer/keyboard input. */
    --_lr-multi-split-divider-target-size: max(
      var(--lr-icon-button-size),
      var(--lr-size-3px)
    );
  }
  [part="base"] {
    display: flex;
    /* Anchor for the 'floating' collapse state's absolutely-positioned
       overlay panel (set inline by multi-split.class.ts's updated()). */
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
  }
  ::slotted(*) {
    /* Honest no-JS/first-hydration fallback before child count and live sizes can be observed.
       Browser reconciliation writes a more specific inline flex value once available. */
    flex: 1 1 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Direct panels own their overflow. The zero minimum lets a fixed-height
       split shrink each flex item along the block axis instead of letting
       long content expand the base and escape into following content. */
    min-block-size: 0;
    max-block-size: 100%;
    overflow: auto;
    overflow-wrap: anywhere;
  }
  :host([orientation="vertical"]) [part="base"] {
    flex-direction: column;
  }
  [part="divider"] {
    position: relative;
    flex: 0 0 auto;
    inline-size: var(
      --lr-multi-split-divider-target-size,
      var(--_lr-multi-split-divider-target-size)
    );
    min-block-size: min(
      100%,
      var(
        --lr-multi-split-divider-target-size,
        var(--_lr-multi-split-divider-target-size)
      )
    );
    max-block-size: 100%;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
  }
  /* Paint the narrow visual rule inside the allocated target track. */
  [part="divider"]::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline: calc((100% - var(--lr-size-3px)) / 2);
    background: var(--lr-color-border);
    pointer-events: none;
  }
  /* :where() zeroes the [orientation='vertical'] qualifier's specificity contribution -- otherwise
     this (0,3,0) rule would beat a consumer's own ::part(divider) inline-size/cursor override
     whenever orientation="vertical" is set. */
  :host(:where([orientation="vertical"])) [part="divider"] {
    inline-size: 100%;
    min-inline-size: min(
      100%,
      var(
        --lr-multi-split-divider-target-size,
        var(--_lr-multi-split-divider-target-size)
      )
    );
    max-inline-size: 100%;
    min-block-size: 0;
    block-size: var(
      --lr-multi-split-divider-target-size,
      var(--_lr-multi-split-divider-target-size)
    );
    cursor: row-resize;
  }
  :host(:where([orientation="vertical"])) [part="divider"]::before {
    inset-block: calc((100% - var(--lr-size-3px)) / 2);
    inset-inline: 0;
  }
  /* orientationBreakpoint's live axis -- only present while that feature is opted into (see
     multi-split.class.ts's updated()), so it can override the authored orientation rules above by source
     order alone (equal specificity) whenever the effective axis diverges from it. */
  :host([data-effective-orientation="vertical"]) [part="base"] {
    flex-direction: column;
  }
  :host([data-effective-orientation="horizontal"]) [part="base"] {
    flex-direction: row;
  }
  /* Same :where() treatment as [orientation='vertical'] above, applied to both effective-axis
     variants -- these are the higher-specificity rules orientationBreakpoint's live axis relies on
     to override the authored orientation by source order (see the comment above), so without
     :where() they'd beat a consumer's ::part(divider) override even more readily than the
     authored-orientation rules do. */
  :host(:where([data-effective-orientation="vertical"])) [part="divider"] {
    inline-size: 100%;
    min-inline-size: min(
      100%,
      var(
        --lr-multi-split-divider-target-size,
        var(--_lr-multi-split-divider-target-size)
      )
    );
    max-inline-size: 100%;
    min-block-size: 0;
    block-size: var(
      --lr-multi-split-divider-target-size,
      var(--_lr-multi-split-divider-target-size)
    );
    cursor: row-resize;
  }
  :host(:where([data-effective-orientation="vertical"]))
    [part="divider"]::before {
    inset-block: calc((100% - var(--lr-size-3px)) / 2);
    inset-inline: 0;
  }
  :host(:where([data-effective-orientation="horizontal"])) [part="divider"] {
    inline-size: var(
      --lr-multi-split-divider-target-size,
      var(--_lr-multi-split-divider-target-size)
    );
    min-block-size: min(
      100%,
      var(
        --lr-multi-split-divider-target-size,
        var(--_lr-multi-split-divider-target-size)
      )
    );
    max-block-size: 100%;
    block-size: auto;
    cursor: col-resize;
  }
  :host(:where([data-effective-orientation="horizontal"]))
    [part="divider"]::before {
    inset-block: 0;
    inset-inline: calc((100% - var(--lr-size-3px)) / 2);
  }
  [part="divider"]:hover::before {
    background: var(--lr-color-brand);
  }
  /* The drag itself. Pointer capture holds :active for the whole gesture, so the divider stays at
     the deeper mix from mousedown until release -- and a divider adjacent to a collapsed pane
     never reaches it, since [aria-disabled='true'] below takes its pointer events away. */
  [part="divider"]:active::before {
    background: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="divider"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The divider adjacent to a rail/floating-collapsed pane (see multi-split.class.ts's
     isDividerDisabled()) — geometry (position/inset/inline-size) for the
     collapsing panel itself is set inline by updated(), same as the
     pre-existing flex/order styling; this only covers the divider's own
     drag/hover affordance and the floating panel's elevation, which read
     more naturally as stylesheet rules than one-off inline styles. */
  [part="divider"][aria-disabled="true"] {
    cursor: default;
    pointer-events: none;
  }
  /* The 'floating' collapse state's overlay "card" look -- geometry
     (position, the inset-* longhands, inline-size) is set inline by multi-split.class.ts's updated(),
     matching how the ordinary flex/order styling is applied; only the
     visual/stacking treatment lives here. z-index is above [part="backdrop"]
     (below), so the drawer renders on top of its own scrim. */
  ::slotted([data-collapse-state="floating"]) {
    z-index: var(--lr-layer-content);
    background: var(--lr-color-surface);
    border-radius: var(--lr-radius);
    /* Modal step: this is a drawer rendered above its own scrim (see [part='backdrop'] below), not
       an anchored popup, so it takes the modal tier. */
    box-shadow: var(--lr-shadow-l);
  }
  /* The 'floating' drawer's scrim -- only rendered while collapseState is
     'floating' and open (see multi-split.class.ts's render()). Scoped to [part="base"]
     (position: absolute against its position: relative ancestor) rather than
     a viewport-fixed overlay like lr-app-rail's mobile backdrop: the
     floating panel itself is only ever positioned relative to this
     component's own box, never the full page. */
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-base);
    background: var(
      --lr-multi-split-overlay-color,
      var(--_lr-multi-split-overlay-color)
    );
  }
  /* Rail-clamped content can easily overflow the fixed rail-width — clip it
     rather than letting it blow out the layout; the panel's own content is
     expected to adapt to the narrower width itself (e.g. via a container
     query), this is just a safety net. */
  ::slotted([data-collapse-state="rail"]) {
    overflow: hidden;
  }
`;
