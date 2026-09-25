import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
    /* Component-specific, not a shared token: lets a consumer retheme without a raw literal in
       the public API -- matches lr-app-rail's --lr-app-rail-overlay-color. */
    --_lr-multi-split-overlay-color: var(--lr-color-overlay);
    /* A real target gutter, not a pseudo element over the neighbors: only the centered line
       paints, the whole track takes pointer/keyboard input. */
    --_lr-multi-split-divider-target-size: max(
      var(--lr-icon-button-size),
      var(--lr-size-3px)
    );
    /* The painted hairline's own thickness, independent of the target-size track above. Only
       the ::before inset calc below reads this -- the WCAG 2.5.8 pointer target stays governed
       solely by --lr-multi-split-divider-target-size, so retuning one can never shrink the
       other. */
    --_lr-multi-split-divider-thickness: var(--lr-size-3px);
    --_lr-multi-split-divider-color: var(--lr-color-border);
    --_lr-multi-split-divider-hover-color: var(--lr-color-brand);
    --_lr-multi-split-divider-active-color: color-mix(
      in oklab,
      var(--lr-color-brand),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="base"] {
    --_lr-multi-split-panel-min: 0;
    --_lr-multi-split-gutters: 0;
    display: flex;
    /* Anchor for the absolutely-positioned 'floating' overlay panel, set inline by updated(). */
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    block-size: 100%;
  }
  ::slotted(*) {
    /* No-JS/first-hydration fallback; an inline flex value replaces it once child count and live
       sizes are observable. */
    flex: 1 1 0;
    min-inline-size: var(--_lr-multi-split-panel-min, 0);
    max-inline-size: 100%;
    /* Panels own their overflow. The zero block minimum lets a fixed-height split shrink flex
       items rather than let long content expand the base into following content. */
    min-block-size: 0;
    max-block-size: 100%;
    overflow: auto;
    overflow-wrap: anywhere;
    /* box-sizing does not inherit across the slot boundary, so a slotted panel with its own
       padding/border would otherwise overflow the percent/flex-basis allocation computed for its
       content-box. */
    box-sizing: border-box;
  }
  /* The display above is author-origin, so it outranks the UA stylesheet's own
     '[hidden] { display: none }' -- restating it keeps a hidden panel (including the 'floating'
     drawer's closed state, applied via applyOwnedPanelHidden()) actually invisible. '!important'
     is required, not stylistic: per CSS Cascade 5's shadow-tree encapsulation-context ordering, a
     normal-weight rule in the slotted element's OWN (light-DOM) tree already outranks a
     same-specificity ::slotted() rule declared in this shadow tree, so any author 'display' rule
     targeting the panel directly would otherwise silently win and re-show it. Only '!important'
     reverses that so this (inner) tree wins. The :not([hidden='until-found' i]) carve-out
     matches every other ::slotted([hidden]) override in the library. */
  ::slotted([hidden]:not([hidden="until-found" i])) {
    display: none !important;
  }
  :host([orientation="vertical"]) [part="base"] {
    flex-direction: column;
  }
  :host([orientation="vertical"]) ::slotted(*),
  :host([data-effective-orientation="vertical"]) ::slotted(*) {
    min-inline-size: 0;
    min-block-size: var(--_lr-multi-split-panel-min, 0);
  }
  :host([data-effective-orientation="horizontal"]) ::slotted(*) {
    min-inline-size: var(--_lr-multi-split-panel-min, 0);
    min-block-size: 0;
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
    inset-inline: calc(
      (
          100% -
            var(
              --lr-multi-split-divider-thickness,
              var(--_lr-multi-split-divider-thickness)
            )
        ) / 2
    );
    background: var(
      --lr-multi-split-divider-color,
      var(--_lr-multi-split-divider-color)
    );
    pointer-events: none;
  }
  /* :where() drops this from (0,3,0) to (0,1,0); at (0,3,0) its cursor: row-resize out-ranks the
     (0,2,0) [part='divider'][aria-disabled='true'] rule below, and a divider beside a collapsed
     pane advertises a drag it refuses. */
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
    inset-block: calc(
      (
          100% -
            var(
              --lr-multi-split-divider-thickness,
              var(--_lr-multi-split-divider-thickness)
            )
        ) / 2
    );
    inset-inline: 0;
  }
  /* orientationBreakpoint's live axis, present only when that feature is opted into (updated()).
     Equal specificity to the authored orientation rules above, so source order wins when the
     effective axis diverges. */
  :host([data-effective-orientation="vertical"]) [part="base"] {
    flex-direction: column;
  }
  :host([data-effective-orientation="horizontal"]) [part="base"] {
    flex-direction: row;
  }
  /* Same :where() flattening as [orientation='vertical'] above, on both effective-axis variants:
     these override the authored orientation by source order, and must stay under the
     [part='divider'][aria-disabled='true'] cursor rule below. */
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
    inset-block: calc(
      (
          100% -
            var(
              --lr-multi-split-divider-thickness,
              var(--_lr-multi-split-divider-thickness)
            )
        ) / 2
    );
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
    inset-inline: calc(
      (
          100% -
            var(
              --lr-multi-split-divider-thickness,
              var(--_lr-multi-split-divider-thickness)
            )
        ) / 2
    );
  }
  [part="divider"]:hover::before {
    background: var(
      --lr-multi-split-divider-hover-color,
      var(--_lr-multi-split-divider-hover-color)
    );
  }
  /* Pointer capture holds :active for the whole gesture, so the deeper mix persists from mousedown
     to release; a divider beside a collapsed pane never reaches it -- [aria-disabled='true'] below
     removes its pointer events. */
  [part="divider"]:active::before {
    background: var(
      --lr-multi-split-divider-active-color,
      var(--_lr-multi-split-divider-active-color)
    );
  }
  [part="divider"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The divider beside a rail/floating-collapsed pane (isDividerDisabled()). The collapsing
     panel's live flex/order/inline-size are set inline by updated(); only the divider's drag/hover
     affordance and the floating panel's elevation stay stylesheet rules. */
  [part="divider"][aria-disabled="true"] {
    cursor: default;
    pointer-events: none;
  }
  /* A closed floating drawer removes only its own adjacent divider track. The same divider is
     retained while the drawer is open and in the rail state, where it still separates visible
     panes. */
  :host(:where([data-collapse-state="floating"]:not([open])))
    [part="divider"][aria-disabled="true"] {
    display: none;
  }
  /* The 'floating' overlay card. flex and order stay inline, set by updated() from the live
     sizes[i] percent -- the value 'wide' renders at, so un-floating never jumps; retune via
     .sizes, since the live sync undoes a direct override of those two. inline-size is also set
     inline, but wrapped as a var() reading --lr-multi-split-floating-panel-inline-size with the
     live percent as its fallback -- that fallback keeps it byte-identical when unset, while the
     custom property itself is a durable seam a consumer can set (e.g. on an ancestor) to override
     the geometry at normal specificity, without !important, and without it being undone by the
     next live-sync render. position is a fixed default a consumer overrides at normal specificity
     without !important; the block insets and the inset-inline-* edge below read
     --lr-multi-split-floating-panel-inset, whose 0 fallback keeps an unset drawer flush with
     [part="base"] exactly as before, so one declaration insets the drawer on all three of its
     anchored edges instead of restating the two logical properties per direction. z-index
     above [part="backdrop"] covers the drawer's scrim. */
  ::slotted([data-collapse-state="floating"]) {
    position: absolute;
    inset-block: var(--lr-multi-split-floating-panel-inset, 0);
    z-index: var(--lr-layer-content);
    background: var(--lr-color-surface);
    border-radius: var(--lr-radius);
    /* Modal tier: a drawer above its own scrim ([part='backdrop'] below), not an anchored popup. */
    box-shadow: var(--lr-shadow-l);
  }
  /* The drawer's anchor edge mirrors collapse (LOGICAL 'start'/'end', per its property doc),
     already reflected on the host, so no per-panel marker is needed; collapse is never both, so
     exactly one rule matches. */
  :host([collapse="start"]) ::slotted([data-collapse-state="floating"]) {
    inset-inline-start: var(--lr-multi-split-floating-panel-inset, 0);
  }
  :host([collapse="end"]) ::slotted([data-collapse-state="floating"]) {
    inset-inline-end: var(--lr-multi-split-floating-panel-inset, 0);
  }
  /* The 'floating' drawer's scrim, rendered only while collapseState is 'floating' and open (see
     render()). Absolute against [part="base"], not viewport-fixed like lr-app-rail's mobile
     backdrop -- the floating panel is positioned against this component's box, never the page. */
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    z-index: var(--lr-layer-base);
    background: var(
      --lr-multi-split-overlay-color,
      var(--_lr-multi-split-overlay-color)
    );
  }
  /* Safety net: rail-clamped content can overflow the fixed rail width, so clip rather than blow
     out the layout; the panel's content should adapt itself, e.g. via a container query. */
  ::slotted([data-collapse-state="rail"]) {
    overflow: hidden;
  }
`;
