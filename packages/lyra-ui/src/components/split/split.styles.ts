import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    /* Component-specific -- not a shared design token, so a consumer can
       retheme it without a raw literal leaking into the public API (same
       rationale as lyra-app-rail's --lyra-app-rail-overlay-color). */
    --lyra-split-overlay-color: rgb(0 0 0 / 0.5);
  }
  [part='base'] {
    display: flex;
    /* Anchor for the 'floating' collapse state's absolutely-positioned
       overlay panel (set inline by split.ts's updated()). */
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  [part='divider'] {
    position: relative;
    flex: 0 0 auto;
    inline-size: 3px;
    block-size: auto;
    background: var(--lyra-color-border);
    cursor: col-resize;
    touch-action: none;
  }
  /* Transparent hit-slop: widens the draggable/tappable box along the resize
     axis only, without changing the divider's visible 3px width. Generated
     content is part of the originating element's hit-test box, so pointer
     events here still resolve e.target to [part="divider"] itself. */
  [part='divider']::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: -6px;
  }
  :host([orientation='vertical']) [part='divider'] {
    inline-size: auto;
    block-size: 3px;
    cursor: row-resize;
  }
  :host([orientation='vertical']) [part='divider']::before {
    inset-block: -6px;
    inset-inline: 0;
  }
  [part='divider']:hover {
    background: var(--lyra-color-brand);
  }
  [part='divider']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  /* The divider adjacent to a rail/floating-collapsed pane (see split.ts's
     isDividerDisabled()) — geometry (position/inset/inline-size) for the
     collapsing panel itself is set inline by updated(), same as the
     pre-existing flex/order styling; this only covers the divider's own
     drag/hover affordance and the floating panel's elevation, which read
     more naturally as stylesheet rules than one-off inline styles. */
  [part='divider'][aria-disabled='true'] {
    cursor: default;
    pointer-events: none;
  }
  /* The 'floating' collapse state's overlay "card" look -- geometry
     (position/inset-*/inline-size) is set inline by split.ts's updated(),
     matching how the ordinary flex/order styling is applied; only the
     visual/stacking treatment lives here. z-index is above [part="backdrop"]
     (below), so the drawer renders on top of its own scrim. */
  ::slotted([data-collapse-state='floating']) {
    z-index: 1;
    background: var(--lyra-color-surface);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
  }
  /* The 'floating' drawer's scrim -- only rendered while collapseState is
     'floating' and open (see split.ts's render()). Scoped to [part="base"]
     (position: absolute against its position: relative ancestor) rather than
     a viewport-fixed overlay like lyra-app-rail's mobile backdrop: the
     floating panel itself is only ever positioned relative to this
     component's own box, never the full page. */
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: var(--lyra-split-overlay-color);
  }
  /* Rail-clamped content can easily overflow the fixed rail-width — clip it
     rather than letting it blow out the layout; the panel's own content is
     expected to adapt to the narrower width itself (e.g. via a container
     query), this is just a safety net. */
  ::slotted([data-collapse-state='rail']) {
    overflow: hidden;
  }
`;
